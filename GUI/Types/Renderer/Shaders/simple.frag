#version 460

// Includes
#include "common/utils.glsl"
#include "common/rendermodes.glsl"

// Render modes -- Switched on/off by code
#define renderMode_Diffuse 0
#define renderMode_Specular 0
#define renderMode_PBR 0
#define renderMode_Cubemaps 0
#define renderMode_Irradiance 0
#define renderMode_VertexColor 0
#define renderMode_Terrain_Blend 0
#define renderMode_ExtraParams 0

#define D_BAKED_LIGHTING_FROM_LIGHTMAP 0
#define D_BAKED_LIGHTING_FROM_VERTEX_STREAM 0
#define D_BAKED_LIGHTING_FROM_LIGHTPROBE 0
#define LightmapGameVersionNumber 0

#if defined(vr_simple_2way_blend_vfx) || defined (csgo_simple_2way_blend_vfx) || defined(steampal_2way_blend_mask_vfx)
    #define simple_blend_common
#elif defined(vr_simple_vfx) || defined(csgo_simple_vfx)
    #define simple_vfx_common
#elif defined(vr_complex_vfx) || defined(csgo_complex_vfx)
    #define complex_vfx_common
#elif defined(vr_glass_vfx) || defined(csgo_glass_vfx)
    #define glass_vfx_common
#elif defined(vr_static_overlay_vfx) || defined(csgo_static_overlay_vfx)
    #define static_overlay_vfx_common
#endif

//Parameter defines - These are default values and can be overwritten based on material/model parameters
// BLENDING
#define F_FULLBRIGHT 0
#define F_LIT 0
#define F_UNLIT 0
#define F_PAINT_VERTEX_COLORS 0
#define F_ADDITIVE_BLEND 0
#define F_ALPHA_TEST 0
#define F_TRANSLUCENT 0
#define F_BLEND_MODE 0
#define F_GLASS 0
#define F_DISABLE_TONE_MAPPING 0
#define F_RENDER_BACKFACES 0
#define F_MORPH_SUPPORTED 0
#define F_WRINKLE 0
#define F_DONT_FLIP_BACKFACE_NORMALS 0
#define F_SCALE_NORMAL_MAP 0
// TEXTURING
#define F_LAYERS 0
#define F_TINT_MASK 0
#define F_FANCY_BLENDING 0
#define F_METALNESS_TEXTURE 0
#define F_AMBIENT_OCCLUSION_TEXTURE 0
#define F_FANCY_BLENDING 0
#define F_DETAIL_TEXTURE 0
#define F_SELF_ILLUM 0
#define F_SECONDARY_UV 0
#define F_ENABLE_AMBIENT_OCCLUSION 0 // simple_2way_blend
#define F_ENABLE_TINT_MASKS 0 // simple_2way_blend
#define F_DECAL_TEXTURE 0
#define F_DECAL_BLEND_MODE 0
#define F_FORCE_UV2 0
// SHADING
#define F_SPECULAR 0
#define F_SPECULAR_INDIRECT 0
#define F_RETRO_REFLECTIVE 0
#define F_ANISOTROPIC_GLOSS 0
#define F_SPECULAR_CUBE_MAP_ANISOTROPIC_WARP 0 // only optional in HLA
#define F_SPHERICAL_PROJECTED_ANISOTROPIC_TANGENTS 0
#define F_CLOTH_SHADING 0
#define F_USE_BENT_NORMALS 0
#define F_DIFFUSE_WRAP 0
#define F_TRANSMISSIVE_BACKFACE_NDOTL 0 // todo
#define F_NO_SPECULAR_AT_FULL_ROUGHNESS 0
// SKIN
#define F_SUBSURFACE_SCATTERING 0 // todo, same preintegrated method as vr_skin in HLA
#define F_USE_FACE_OCCLUSION_TEXTURE 0 // todo, weird
#define F_USE_PER_VERTEX_CURVATURE 0 // todo
#define F_SSS_MASK 0 // todo

#define HemiOctIsoRoughness_RG_B 0
//End of feature defines

in vec3 vFragPosition;

in vec3 vNormalOut;
in vec3 vTangentOut;
in vec3 vBitangentOut;
in vec2 vTexCoordOut;
in vec4 vVertexColorOut;

centroid in vec3 vCentroidNormalOut;

#if (F_SECONDARY_UV == 1) || (F_FORCE_UV2 == 1)
    in vec2 vTexCoord2;
    uniform bool g_bUseSecondaryUvForAmbientOcclusion = true;
    #if F_TINT_MASK
        uniform bool g_bUseSecondaryUvForTintMask = true;
    #endif
    #if F_DETAIL_TEXTURE > 0
        uniform bool g_bUseSecondaryUvForDetailMask = true;
    #endif
    #if F_SELF_ILLUM == 1
        uniform bool g_bUseSecondaryUvForSelfIllum = false;
    #endif
#endif

#if defined(csgo_lightmappedgeneric_vfx) || defined(csgo_vertexlitgeneric_vfx)
    #define S_SPECULAR F_SPECULAR_INDIRECT
#elif defined(vr_complex_vfx)
    #define S_SPECULAR F_SPECULAR
#elif defined(generic_vfx)
    #define S_SPECULAR 0
#else
    #define S_SPECULAR 1 // Indirect
#endif


#if defined(steampal_2way_blend_mask_vfx)
    uniform sampler2D g_tLayer2Color;
    uniform sampler2D g_tLayer2NormalRoughness;
#elif (defined(simple_blend_common) || (F_LAYERS > 0))
    in vec4 vColorBlendValues;
    uniform sampler2D g_tLayer2Color;
    uniform sampler2D g_tLayer2NormalRoughness;
#endif

#if defined(vr_skin_vfx)
    uniform sampler2D g_tCombinedMasks;
    uniform vec4 g_vTransmissionColor = vec4(0.74902, 0.231373, 0.011765, 0.0);
    uniform float g_flMouthInteriorBrightnessScale = 1.0;
#endif

#if (F_SELF_ILLUM == 1)
    #if !defined(vr_skin_vfx)
        uniform sampler2D g_tSelfIllumMask;
    #endif
    uniform float g_flSelfIllumAlbedoFactor = 0.0;
    uniform float g_flSelfIllumBrightness = 0.0;
    uniform float g_flSelfIllumScale = 1.0;
    uniform vec4 g_vSelfIllumScrollSpeed = vec4(0.0);
    uniform vec4 g_vSelfIllumTint = vec4(1.0);
#endif

out vec4 outputColor;

uniform sampler2D g_tColor;
uniform sampler2D g_tNormal;
uniform sampler2D g_tTintMask;

#include "common/ViewConstants.glsl"
#include "common/LightingConstants.glsl"

uniform float g_flAlphaTestReference = 0.5;
uniform float g_flOpacityScale = 1.0;

#define _uniformMetalness (defined(simple_vfx_common) || defined(complex_vfx_common)) && (F_METALNESS_TEXTURE == 0)
#define _colorAlphaMetalness (defined(simple_vfx_common) || defined(complex_vfx_common)) && (F_METALNESS_TEXTURE == 1)
#define _colorAlphaAO (defined(vr_simple_vfx) && (F_AMBIENT_OCCLUSION_TEXTURE == 1) && (F_METALNESS_TEXTURE == 0)) || (F_ENABLE_AMBIENT_OCCLUSION == 1) // only vr_simple_vfx
#define _metalnessTexture (defined(complex_vfx_common) && (F_METALNESS_TEXTURE == 1) && ((F_RETRO_REFLECTIVE == 1) || (F_ALPHA_TEST == 1) || (F_TRANSLUCENT == 1))) || defined(csgo_weapon_vfx) || defined(csgo_character_vfx)
#define _ambientOcclusionTexture ( (defined(vr_simple_vfx) && (F_AMBIENT_OCCLUSION_TEXTURE == 1) && (F_METALNESS_TEXTURE == 1)) || defined(complex_vfx_common) || defined(csgo_foliage_vfx) || defined(csgo_weapon_vfx) || defined(csgo_character_vfx) || defined(csgo_lightmappedgeneric_vfx) || defined(csgo_vertexlitgeneric_vfx))

#define unlit (defined(unlit_vfx) || defined(csgo_unlitgeneric_vfx) || (F_FULLBRIGHT == 1) || (F_UNLIT == 1) || (defined(static_overlay_vfx_common) && F_LIT == 0))
#define alphatest (F_ALPHA_TEST == 1) || ((defined(csgo_unlitgeneric_vfx) || defined(static_overlay_vfx_common)) && (F_BLEND_MODE == 2))
#define translucent (F_TRANSLUCENT == 1) || ((defined(csgo_unlitgeneric_vfx) || defined(static_overlay_vfx_common)) && (F_BLEND_MODE == 1)) // need to set this up on the cpu side

#if (_uniformMetalness)
    uniform float g_flMetalness = 0.0;
#elif (_metalnessTexture)
    uniform sampler2D g_tMetalness;
#endif

uniform vec4 g_vTexCoordScale2 = vec4(1.0);

#if (F_FANCY_BLENDING > 0)
    uniform sampler2D g_tBlendModulation;
    uniform float g_flBlendSoftness;
#endif

#if defined(simple_blend_common)
    uniform sampler2D g_tMask;
    uniform float g_flMetalnessA = 0.0;
    uniform float g_flMetalnessB = 0.0;

    #if defined(steampal_2way_blend_mask_vfx)
        uniform float g_BlendFalloff = 0.0;
        uniform float g_BlendHeight = 0.0;
    #endif
#endif

#if (F_RETRO_REFLECTIVE == 1)
    uniform float g_flRetroReflectivity = 1.0;
#endif

#if (F_SCALE_NORMAL_MAP == 1)
    uniform float g_flNormalMapScaleFactor = 1.0;
#endif

uniform float g_flBumpStrength = 1.0;

#if (_ambientOcclusionTexture)
    uniform sampler2D g_tAmbientOcclusion;
#endif

#if (F_ANISOTROPIC_GLOSS == 1)
#define VEC2_ROUGHNESS
#define renderMode_AnisoGloss 0
    uniform sampler2D g_tAnisoGloss;
#endif


// These two must be first
#include "common/lighting_common.glsl"
#include "common/texturing.glsl"

#include "common/pbr.glsl"

#if (S_SPECULAR == 1 || renderMode_Cubemaps == 1)
#include "common/environment.glsl"
#endif
#include "common/fog.glsl"

// Must be last
#include "common/lighting.glsl"



// Get material properties
MaterialProperties_t GetMaterial(vec2 texCoord, vec3 vertexNormals)
{
    MaterialProperties_t mat;
    InitProperties(mat, vertexNormals);

    vec4 color = texture(g_tColor, texCoord);
    vec4 normalTexture = texture(g_tNormal, texCoord);

    color.rgb = pow(color.rgb, gamma);


    // Blending
#if (F_LAYERS > 0) || defined(simple_blend_common) || defined(steampal_2way_blend_mask_vfx)
    vec2 texCoordB = texCoord * g_vTexCoordScale2.xy;

    vec4 color2 = texture(g_tLayer2Color, texCoordB);
    vec4 normalTexture2 = texture(g_tLayer2NormalRoughness, texCoordB);

    color2.rgb = pow(color2.rgb, gamma);

    // 0: VertexBlend 1: BlendModulateTexture,rg 2: NewLayerBlending,g 3: NewLayerBlending,a
    #if (F_FANCY_BLENDING > 0)
        float blendFactor = vColorBlendValues.r;
        vec4 blendModTexel = texture(g_tBlendModulation, texCoordB);

        #if (F_FANCY_BLENDING == 1)
            blendFactor = ApplyBlendModulation(blendFactor, blendModTexel.g, blendModTexel.r);
        #elif (F_FANCY_BLENDING == 2)
            blendFactor = ApplyBlendModulation(blendFactor, blendModTexel.g, g_flBlendSoftness);
        #elif (F_FANCY_BLENDING == 3)
            blendFactor = ApplyBlendModulation(blendFactor, blendModTexel.a, g_flBlendSoftness);
        #endif
    #elif defined(steampal_2way_blend_mask_vfx)
        float blendFactor = texture(g_tMask, texCoordB).x;

        blendFactor = ApplyBlendModulation(blendFactor, g_BlendFalloff, g_BlendHeight);

    #elif (defined(simple_blend_common))
        float blendFactor = vColorBlendValues.r;
        vec4 blendModTexel = texture(g_tMask, texCoordB);

        #if defined(csgo_simple_2way_blend_vfx)
            float softnessPaint = vColorBlendValues.a;
        #else
            float softnessPaint = vColorBlendValues.g;
        #endif

        blendFactor = ApplyBlendModulation(blendFactor, blendModTexel.r, softnessPaint);
    #else
        float blendFactor = vColorBlendValues.r;
    #endif

    #if (F_ENABLE_TINT_MASKS == 1)
        vec2 tintMasks = texture(g_tTintMask, texCoord).xy;

        vec3 tintFactorA = 1.0 - tintMasks.x * (1.0 - vVertexColorOut.rgb);
        vec3 tintFactorB = 1.0 - tintMasks.y * (1.0 - vVertexColorOut.rgb);

        color.rgb *= tintFactorA;
        color2.rgb *= tintFactorB;
    #endif


    color = mix(color, color2, blendFactor);
    // It's more correct to blend normals after decoding, but it's not actually how S2 does it
    normalTexture = mix(normalTexture, normalTexture2, blendFactor);
#endif


    // Vr_skin unique stuff
#if defined(vr_skin_vfx)
    // r=MouthMask, g=AO, b=selfillum/tint mask, a=SSS/opacity
    vec4 combinedMasks = texture(g_tCombinedMasks, texCoord);

    mat.ExtraParams.a = combinedMasks.x; // Mouth Mask
    mat.AmbientOcclusion = combinedMasks.y;

    #if (F_SELF_ILLUM)
        float selfIllumMask = combinedMasks.z;
    #elif (F_TINT_MASK)
        float flTintMask = combinedMasks.z;
    #endif

    #if (F_SSS_MASK == 1)
        mat.SSSMask = combinedMasks.a;
    #endif

    #if (F_TRANSLUCENT > 0) || (alphatest == 1)
        mat.Opacity = combinedMasks.a;
    #endif
#endif


    mat.Albedo = color.rgb;
    mat.Opacity = color.a;
/*
#if defined(static_overlay_vfx_common) && (F_PAINT_VERTEX_COLORS == 1)
    mat.Opacity *= vVertexColorOut.a;
#endif
*/

#if (F_TRANSLUCENT > 0)
    mat.Opacity *= g_flOpacityScale;
#endif

    // Alpha test
#if (alphatest == 1)
    mat.Opacity = AlphaTestAntiAliasing(mat.Opacity, texCoord);

    if (mat.Opacity - 0.001 < g_flAlphaTestReference)   discard;
#endif


    // Tinting
#if (F_ENABLE_TINT_MASKS == 0)
    vec3 tintColor = vVertexColorOut.rgb;

    #if (F_TINT_MASK == 1)
        #if (F_SECONDARY_UV == 1) || (F_FORCE_UV2 == 1)
            vec2 tintMaskTexcoord = (g_bUseSecondaryUvForTintMask || (F_FORCE_UV2 == 1)) ? vTexCoord2 : texCoord;
        #else
            vec2 tintMaskTexcoord = texCoord;
        #endif
        float tintStrength = texture(g_tTintMask, tintMaskTexcoord).x;
        tintColor = 1.0 - tintStrength * (1.0 - tintColor.rgb);
    #endif

    mat.Albedo *= tintColor;
#endif


    // Normals and Roughness
    mat.NormalMap = DecodeNormal(normalTexture);

#if (F_ANISOTROPIC_GLOSS == 1)
    mat.RoughnessTex = texture(g_tAnisoGloss, texCoord).rg;
#else
    mat.RoughnessTex = normalTexture.b;
#endif


#if (F_SCALE_NORMAL_MAP == 1)
    mat.NormalMap = normalize(mix(vec3(0, 0, 1), mat.NormalMap, g_flNormalMapScaleFactor));
#else
    mat.NormalMap = normalize(mix(vec3(0, 0, 1), mat.NormalMap, g_flBumpStrength));
#endif


    // Detail texture
#if (F_DETAIL_TEXTURE > 0)
    #if (F_SECONDARY_UV == 1) || (F_FORCE_UV2 == 1)
        vec2 detailMaskCoords = (g_bUseSecondaryUvForDetailMask || (F_FORCE_UV2 == 1)) ? vTexCoord2 : texCoord;
    #else
        vec2 detailMaskCoords = texCoord;
    #endif
    applyDetailTexture(mat.Albedo, mat.NormalMap, detailMaskCoords);
#endif

    mat.Normal = calculateWorldNormal(mat.NormalMap, mat.GeometricNormal, mat.Tangent, mat.Bitangent);


    // Metalness
#if (_metalnessTexture)
    // a = rimmask
    vec4 metalnessTexture = texture(g_tMetalness, texCoord);

    mat.Metalness = metalnessTexture.g;

    #if (F_RETRO_REFLECTIVE == 1)
        // not exclusive to csgo_character
        mat.ExtraParams.x = metalnessTexture.r;
    #endif
    #if defined(csgo_character_vfx)
        mat.ClothMask = metalnessTexture.b * (1.0 - metalnessTexture.g);
    #elif defined(csgo_weapon_vfx)
        mat.RoughnessTex = metalnessTexture.r;
    #endif
#elif (_uniformMetalness)
    mat.Metalness = g_flMetalness;
#elif (_colorAlphaMetalness)
    mat.Metalness = color.a;
#elif defined(simple_blend_common)
    mat.Metalness = mix(g_flMetalnessA, g_flMetalnessB, blendFactor);
#endif

    // Ambient Occlusion
#if (_colorAlphaAO)
    mat.AmbientOcclusion = color.a;
#elif (_ambientOcclusionTexture)
    #if (F_SECONDARY_UV == 1) || (F_FORCE_UV2 == 1)
        mat.AmbientOcclusion = texture(g_tAmbientOcclusion, (g_bUseSecondaryUvForAmbientOcclusion || (F_FORCE_UV2 == 1)) ? vTexCoord2 : texCoord).r;
    #else
        mat.AmbientOcclusion = texture(g_tAmbientOcclusion, texCoord).r;
    #endif
#endif

#if defined(vr_complex_vfx) && (F_METALNESS_TEXTURE == 0) && (F_RETRO_REFLECTIVE == 1)
    mat.ExtraParams.x = g_flRetroReflectivity;
#endif
#if defined(vr_complex_vfx) && (F_CLOTH_SHADING == 1)
    mat.ClothMask = 1.0;
#endif

    mat.Roughness = AdjustRoughnessByGeometricNormal(mat.RoughnessTex, mat.GeometricNormal);

#if (F_USE_BENT_NORMALS == 1)
    GetBentNormal(mat, texCoord);
#else
    mat.AmbientNormal = mat.Normal;
    mat.AmbientGeometricNormal = mat.GeometricNormal;
#endif



#if (F_DECAL_TEXTURE == 1)
    mat.Albedo = ApplyDecalTexture(mat.Albedo);
#endif


    mat.DiffuseColor = mat.Albedo - mat.Albedo * mat.Metalness;

#if (F_CLOTH_SHADING == 1) && defined(csgo_character_vfx)
    vec3 F0 = ApplySheen(0.04, mat.Albedo, mat.ClothMask);
#else
    const vec3 F0 = vec3(0.04);
#endif
    mat.SpecularColor = mix(F0, mat.Albedo, mat.Metalness);

    // Self illum
    #if (F_SELF_ILLUM == 1) && !defined(vr_xen_foliage_vfx) // xen foliage has really complicated selfillum and is wrong with this code
        #if (F_SECONDARY_UV == 1) || (F_FORCE_UV2 == 1)
            vec2 selfIllumCoords = (g_bUseSecondaryUvForSelfIllum || (F_FORCE_UV2 == 1)) ? vTexCoord2 : texCoord;
        #else
            vec2 selfIllumCoords = texCoord;
        #endif

        selfIllumCoords += fract(g_vSelfIllumScrollSpeed.xy * g_flTime);

        #if !defined(vr_skin_vfx)
            float selfIllumMask = texture(g_tSelfIllumMask, selfIllumCoords).r; // is this float or rgb?
        #endif

        vec3 selfIllumScale = (exp2(g_flSelfIllumBrightness) * g_flSelfIllumScale) * SrgbGammaToLinear(g_vSelfIllumTint.rgb);
        mat.IllumColor = selfIllumScale * selfIllumMask * mix(vec3(1.0), mat.Albedo, g_flSelfIllumAlbedoFactor);
    #endif

    #if defined(vr_skin_vfx)
        mat.TransmissiveColor = SrgbGammaToLinear(g_vTransmissionColor.rgb) * color.a;

        float mouthOcclusion = mix(1.0, g_flMouthInteriorBrightnessScale, mat.ExtraParams.a);
        mat.TransmissiveColor *= mouthOcclusion;
        mat.AmbientOcclusion *= mouthOcclusion;
    #endif

    #if (F_GLASS == 1) || defined(glass_vfx_common)
        vec4 glassResult = GetGlassMaterial(mat);
        mat.Albedo = glassResult.rgb; 
        mat.Opacity = glassResult.a;
    #endif


    mat.DiffuseAO = vec3(mat.AmbientOcclusion);
    mat.SpecularAO = mat.AmbientOcclusion;

#if (F_ANISOTROPIC_GLOSS == 1)
    CalculateAnisotropicTangents(mat);
#endif

    return mat;
}





// MAIN

void main()
{
    vec3 vertexNormal = SwitchCentroidNormal(vNormalOut, vCentroidNormalOut);
    vec2 texCoord = vTexCoordOut;

    // Get material
    MaterialProperties_t mat = GetMaterial(texCoord, vertexNormal);

    LightingTerms_t lighting = InitLighting();


    outputColor = vec4(mat.Albedo, mat.Opacity);


#if (unlit == 0)

    CalculateDirectLighting(lighting, mat);
    CalculateIndirectLighting(lighting, mat);

    // Combining pass

    ApplyAmbientOcclusion(lighting, mat);

    vec3 diffuseLighting = lighting.DiffuseDirect + lighting.DiffuseIndirect;
    vec3 specularLighting = lighting.SpecularDirect + lighting.SpecularIndirect;

    #if F_NO_SPECULAR_AT_FULL_ROUGHNESS == 1
        specularLighting = (mat.Roughness == 1.0) ? vec3(0) : specularLighting;
    #endif

    // wip
    #if defined(S_TRANSMISSIVE_BACKFACE_NDOTL)
        vec3 transmissiveLighting = o.TransmissiveDirect * mat.TransmissiveColor;
    #else
        const vec3 transmissiveLighting = vec3(0.0);
    #endif

    // Unique HLA Membrane blend mode: specular unaffected by opacity
    #if defined(vr_complex_vfx) && (F_TRANSLUCENT == 2)
        vec3 combinedLighting = specularLighting + (mat.DiffuseColor * diffuseLighting + transmissiveLighting + mat.IllumColor) * mat.Opacity;
        outputColor.a = 1.0;
    #else
        vec3 combinedLighting = mat.DiffuseColor * diffuseLighting + specularLighting + transmissiveLighting + mat.IllumColor;
    #endif

    outputColor.rgb = combinedLighting;
#endif

    //outputColor.rgb = vec3(0.0);
    ApplyFog(outputColor.rgb, mat.PositionWS);

#if (F_DISABLE_TONE_MAPPING == 0)
    outputColor.rgb = pow(outputColor.rgb, invGamma);
    //outputColor.rgb = SrgbGammaToLinear(outputColor.rgb);
#endif

    // Rendermodes

#if renderMode_FullBright == 1
    vec3 fullbrightLighting = CalculateFullbrightLighting(mat.Albedo, mat.Normal, mat.ViewDir);
    outputColor = vec4(pow(fullbrightLighting, invGamma), mat.Opacity);
#endif

#if renderMode_Color == 1
    outputColor = vec4(pow(mat.Albedo, invGamma), 1.0);
#endif

#if renderMode_BumpMap == 1
    outputColor = vec4(PackToColor(mat.NormalMap), 1.0);
#endif

#if renderMode_Tangents == 1
    outputColor = vec4(PackToColor(mat.Tangent), 1.0);
#endif

#if renderMode_Normals == 1
    outputColor = vec4(PackToColor(mat.GeometricNormal), 1.0);
#endif

#if renderMode_BumpNormals == 1
    outputColor = vec4(PackToColor(mat.Normal), 1.0);
#endif

#if (renderMode_Diffuse == 1) && (unlit != 1)
    outputColor.rgb = pow(diffuseLighting * 0.5, invGamma);
#endif

#if (renderMode_Specular == 1) && (unlit != 1)
    outputColor.rgb = pow(specularLighting, invGamma);
#endif

#if renderMode_PBR == 1
    outputColor = vec4(mat.AmbientOcclusion, GetIsoRoughness(mat.Roughness), mat.Metalness, 1.0);
#endif

#if (renderMode_Cubemaps == 1)
    // No bumpmaps, full reflectivity
    vec3 viewmodeEnvMap = GetEnvironment(mat, lighting).rgb;
    outputColor.rgb = pow(viewmodeEnvMap, invGamma);
#endif

#if renderMode_Illumination == 1
    outputColor = vec4(pow(lighting.DiffuseDirect + lighting.SpecularDirect, invGamma), 1.0);
#endif

#if renderMode_Irradiance == 1 && (F_GLASS == 0)
    outputColor = vec4(pow(lighting.DiffuseIndirect, invGamma), 1.0);
#endif

#if renderMode_VertexColor == 1
    outputColor = vVertexColorOut;
#endif

#if renderMode_Terrain_Blend == 1 && (F_LAYERS > 0 || defined(simple_blend_common))
    outputColor.rgb = vColorBlendValues.rgb;
#endif

#if renderMode_ExtraParams == 1
    outputColor.rgb = mat.ExtraParams.rgb;
#endif
#if renderMode_AnisoGloss == 1
    outputColor.rgb = vec3(mat.RoughnessTex.xy, 0.0);
#endif
}
