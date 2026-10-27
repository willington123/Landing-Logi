import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productName,
      category,
      geminiApiKey,
      customPrompt,
      style = 'studio',
      action = 'generate_image',
      imageBase64,
    } = body;

    const apiKey = (geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Se requiere una API Key de Google Gemini. Por favor introduce tu clave en el campo correspondiente (puedes obtener una gratis en Google AI Studio: https://aistudio.google.com/app/apikey).',
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // ACTION: ANALYZE UPLOADED IMAGE & BUILD CREATIVES (GEMINI 2.0 / 1.5 FLASH VISION)
    // Works with any standard free Google AI Studio Key!
    // =========================================================================
    if (action === 'analyze_image' && imageBase64) {
      try {
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.startsWith('data:image/png')) mimeType = 'image/png';
        else if (imageBase64.startsWith('data:image/webp')) mimeType = 'image/webp';

        const promptText = `Eres el director de arte y copywriter de LogiPages AI. Analiza la imagen de este producto físico real y devuelve EXCLUSIVAMENTE un objeto JSON válido (sin formato markdown, sin comillas invertidas, solo las llaves {}) con esta estructura:
{
  "productName": "Nombre comercial atractivo y específico del producto visible en la imagen",
  "category": "Categoría exacta (Tecnología & Gadgets, Hogar, Cuidado Personal, etc.)",
  "headline": "Titular de alto impacto persuasivo para el Banner Hero",
  "subheadline": "Subtítulo de alto impacto enfocado en resolver dudas y destacar pago contraentrega",
  "benefits": [
    "Beneficio 1 visible o deducible del producto en la foto",
    "Beneficio 2 sobre material, autonomía o uso",
    "Beneficio 3 sobre comodidad o facilidad de uso",
    "Beneficio 4 sobre garantía y calidad"
  ],
  "callouts": [
    {"label": "MATERIAL / ACABADO", "text": "Característica visual detectable en la foto"},
    {"label": "FUNCIONALIDAD", "text": "Uso principal o botón/detalle visible"},
    {"label": "DURABILIDAD", "text": "Rendimiento o resistencia"},
    {"label": "GARANTÍA OFICIAL", "text": "30 Días de Garantía Total contraentrega"}
  ],
  "estimatedRegularPrice": 189000,
  "estimatedPromoPrice": 119900,
  "promoBadge": "50% OFF — PAGO CONTRAENTREGA"
}`;

        const visionPayload = {
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
        };

        // 1. Discover live supported models directly from Google for this specific key
        let targetModel = 'gemini-2.0-flash';
        let targetVersion = 'v1beta';

        try {
          const listRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const availableModels = listData?.models || [];
            const contentModels = availableModels.filter(
              (m: any) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent')
            );

            if (contentModels.length > 0) {
              const priority = [
                'gemini-2.0-flash',
                'gemini-2.0-flash-exp',
                'gemini-1.5-flash-latest',
                'gemini-1.5-flash',
                'gemini-1.5-pro',
                'gemini-1.5-flash-001',
                'gemini-1.5-flash-002',
                'gemini-pro',
              ];

              for (const p of priority) {
                const found = contentModels.find((m: any) => m.name && m.name.includes(p));
                if (found) {
                  targetModel = found.name.replace(/^models\//, '');
                  targetVersion = 'v1beta';
                  break;
                }
              }
            }
          }
        } catch {
          // Continue to fallback candidate models
        }

        // 2. Candidate endpoints to try in sequence
        const endpointsToTry = [
          { ver: targetVersion, model: targetModel },
          { ver: 'v1beta', model: 'gemini-2.0-flash' },
          { ver: 'v1beta', model: 'gemini-2.0-flash-exp' },
          { ver: 'v1', model: 'gemini-1.5-flash' },
          { ver: 'v1beta', model: 'gemini-1.5-flash-latest' },
          { ver: 'v1beta', model: 'gemini-1.5-pro' },
          { ver: 'v1', model: 'gemini-pro' },
        ];

        let lastVisionErr = '';
        let parsedData: any = null;

        for (const ep of endpointsToTry) {
          try {
            const visionUrl = `https://generativelanguage.googleapis.com/${ep.ver}/models/${ep.model}:generateContent?key=${apiKey}`;
            const visionRes = await fetch(visionUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(visionPayload),
            });

            if (visionRes.ok) {
              const visionData = await visionRes.json();
              const rawText = visionData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
                break;
              }
            } else {
              const errData = await visionRes.json().catch(() => ({}));
              lastVisionErr = errData?.error?.message || `HTTP ${visionRes.status}`;
            }
          } catch (err: any) {
            lastVisionErr = err.message || String(err);
          }
        }

        // If Gemini succeeded, return AI analysis
        if (parsedData) {
          return NextResponse.json({
            success: true,
            analysis: parsedData,
          });
        }

        // 3. BULLETPROOF FAIL-SAFE: If Google API has model/region restriction,
        // automatically generate high-converting creative analysis so the user is NEVER blocked!
        const cleanName = (productName || 'Producto Exclusivo').trim();
        const smartFallback = {
          productName: cleanName,
          category: category || 'Tecnología & Gadgets',
          headline: `${cleanName} — Edición Original`,
          subheadline: 'Pide hoy con Envío Gratis a toda Colombia y Pago Contraentrega al recibir en tu puerta.',
          benefits: [
            'Diseño ergonómico y acabados premium diseñados para máxima duración.',
            'Fácil de usar desde el primer día con resultados garantizados.',
            'Tecnología de última generación con alto rendimiento y confiabilidad.',
            '30 Días de Garantía Total con satisfacción 100% asegurada.',
          ],
          callouts: [
            { label: 'MATERIAL', text: 'Resistencia superior y acabado ergonómico' },
            { label: 'FUNCIONALIDAD', text: 'Rendimiento optimizado para uso diario' },
            { label: 'PRACTICIDAD', text: 'Uso intuitivo sin complicaciones' },
            { label: 'GARANTÍA', text: '30 Días de Garantía Oficial contraentrega' },
          ],
          estimatedRegularPrice: 199000,
          estimatedPromoPrice: 119900,
          promoBadge: '50% OFF — PAGO CONTRAENTREGA',
        };

        return NextResponse.json({
          success: true,
          fallbackUsed: true,
          warning:
            lastVisionErr ||
            'Google reportó un aviso con el modelo, pero LogiPages construyó automáticamente los 4 creativos de alta conversión.',
          analysis: smartFallback,
        });
      } catch (visionErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Error al analizar imagen con Gemini: ${visionErr.message || visionErr}`,
          },
          { status: 500 }
        );
      }
    }

    // =========================================================================
    // ACTION: GENERATE NEW PHOTOS WITH GOOGLE IMAGEN (IF VERTEX AI IS CONFIGURED)
    // OR GUIDANCE FOR STANDARD GEMINI KEYS
    // =========================================================================
    if (!productName || !productName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Debes especificar el nombre del producto.' },
        { status: 400 }
      );
    }

    const heroPrompt = `Professional commercial studio product photography centered on clean minimal studio background, 8k resolution, cinematic lighting of ${productName}, category: ${category || 'Product'}. ${customPrompt || ''}`;

    const modelsToTry = [
      'imagen-3.0-generate-002',
      'imagen-3.0-fast-generate-001',
    ];

    let lastError: string | null = null;
    let generatedBase64: string | null = null;
    let mimeType = 'image/jpeg';
    let successfulModel = '';

    for (const model of modelsToTry) {
      try {
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        const response = await fetch(imagenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: heroPrompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: '1:1',
              outputMimeType: 'image/jpeg',
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const imgBytes =
            result?.predictions?.[0]?.bytesBase64Encoded ||
            result?.candidates?.[0]?.output?.images?.[0]?.bytesBase64Encoded;
          if (imgBytes) {
            generatedBase64 = imgBytes;
            successfulModel = model;
            mimeType = result?.predictions?.[0]?.mimeType || 'image/jpeg';
            break;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = errData?.error?.message || `HTTP ${response.status} en modelo ${model}`;
        }
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }

    if (!generatedBase64) {
      // Clear guidance: Standard Google AI Studio keys are for Gemini Vision (generateContent)
      return NextResponse.json(
        {
          success: false,
          error:
            'Las API Keys gratuitas de Google AI Studio están optimizadas para Gemini Vision (analizar fotos reales y generar los 4 creativos de alta conversión). Para crear los creativos, simplemente sube la foto de tu producto en la pestaña "Subir Mis Fotos" y Gemini Vision generará automáticamente el Banner Hero, la Infografía, el Combo 2x1 y la Garantía.',
          rawError: lastError,
        },
        { status: 400 }
      );
    }

    const dataUrl = `data:${mimeType};base64,${generatedBase64}`;

    return NextResponse.json({
      success: true,
      generatedWith: successfulModel,
      mainImage: dataUrl,
      galleryImages: [dataUrl],
      promptUsed: heroPrompt,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno al procesar la solicitud.',
      },
      { status: 500 }
    );
  }
}
