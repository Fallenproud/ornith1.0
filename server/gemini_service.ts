/**
 * ULTIMATE ORNITH 1.0 — Server-side Gemini AI Intelligence
 * 
 * Supports gemini-3.8-flash, gemini-3.1-pro-preview (with ThinkingLevel.HIGH),
 * and gemini-3.1-flash-lite for low-latency queries.
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export async function askGeminiOrnith(options: {
  prompt: string;
  history: ChatTurn[];
  modelName?: string;
  useThinking?: boolean;
  projectContext?: {
    projectName?: string;
    datasetName?: string;
    targetArchitecture?: string;
    recordsCount?: number;
    lastMetrics?: any;
  };
}): Promise<{ text: string; thinking?: string; modelUsed: string }> {
  const client = getAiClient();
  const requestedModel = options.modelName || (options.useThinking ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');

  const systemInstruction = `Du er ORNITH 1.0, en høyt spesialisert AI-assistent for lokal TinyML-utvikling og innebygde mikrokontrollere (Arduino Nano 33 BLE, ESP32, STM32, Raspberry Pi Pico).
Dine kjernekompetanser:
1. Norsk naturlig språkprosessering (NLP) med spesiell vekt på bokmål/nynorsk, æ, ø, å, sammensatte ord og n-gram tokenisering for ressursbegrensede edge-enheter.
2. TinyML modellarkitektur: Vektkvantisering (int8/float16), minnefotavtrykk (RAM/Flash), inferenstid og C-header eksport.
3. Strukturert, konsis og faglig autoritativ veiledning.
Gjeldende prosjektkontekst:
- Prosjekt: ${options.projectContext?.projectName || 'Standard Norsk TinyML'}
- Datasett: ${options.projectContext?.datasetName || 'Norsk IoT Kommandoer'} (${options.projectContext?.recordsCount || 40} rader)
- Målarkitektur: ${options.projectContext?.targetArchitecture || 'TinyML Dense'}`;

  // If no Gemini API key configured, provide an intelligent local Ornith response
  if (!client) {
    const p = options.prompt.toLowerCase();
    let reply = "";
    if (p.includes("dataset") || p.includes("norsk") || p.includes("bokmål") || p.includes("tekst")) {
      reply = `**Lokal Ornith Innsikt om det norske datasettet:**\n\nDatasettet inneholder representative norske kommandoer med full støtte for **æ, ø, å** og sammensatte ord som *"garasjeporten"*, *"varmepumpen"* og *"røykvarsleren"*. For TinyML-modeller anbefaler vi ord- og bigram-tokenisering med L2-normalisering for å holde minneforbruket under 16 KB RAM på mikrokontrollere som ESP32 eller Arduino Nano 33 BLE.\n\n*Tips: Du kan konfigurere \`GEMINI_API_KEY\` i miljøvariabler for sky-basert dybderesonnering.*`;
    } else if (p.includes("tren") || p.includes("loss") || p.includes("epoch") || p.includes("accuracy")) {
      reply = `**Lokal Ornith Treningsveileder:**\n\nNår du trener en TinyML-modell med Adam-optimalisering og kategorisk kryssentropi, vil du typisk se tapet (loss) falle under 0.2 i løpet av 20–30 epoker på dette datasettet. Valideringsnøyaktigheten gir et realistisk bilde på hvordan modellen vil generalisere til nye uinnlærte fraser på enheten din.`;
    } else if (p.includes("arduino") || p.includes("c-header") || p.includes("esp32") || p.includes("eksport")) {
      reply = `**Embedded C-kode Generering:**\n\nOrnith eksporterer modellen som en selvstendig C-header (\`ornith_tinyml_model.h\`) som inneholder faste matrisevekter og en ren C \`ornith_predict()\`-funksjon. Denne har null eksterne biblioteksavhengigheter og kompilerer direkte med GCC, Clang eller Arduino IDE.`;
    } else {
      reply = `Hei! Jeg er **ORNITH 1.0**. Jeg er klar til å bistå deg med forberedelse av norske treningsdata, hyperparameter-justering, overvåking av treningsforløpet og eksport til mikrokontroller-vennlige C-headere. Hva vil du undersøke nå?`;
    }
    return {
      text: reply,
      modelUsed: 'local-ornith-engine (offline)',
    };
  }

  try {
    const config: any = {
      systemInstruction,
    };

    if (requestedModel === 'gemini-3.1-pro-preview' && options.useThinking) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    // Build chat conversation
    const contents: any[] = [];
    for (const h of options.history.slice(-6)) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: options.prompt }],
    });

    try {
      const response = await client.models.generateContent({
        model: requestedModel,
        contents,
        config,
      });

      return {
        text: response.text || "Ingen tekst generert.",
        modelUsed: requestedModel,
      };
    } catch (primaryErr: any) {
      // If primary model was busy (503/429), try gemini-3.1-flash-lite for fast low-latency fallback
      if (requestedModel !== 'gemini-3.1-flash-lite') {
        const fallbackResp = await client.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: { systemInstruction },
        });
        return {
          text: fallbackResp.text || "Ingen tekst generert.",
          modelUsed: 'gemini-3.1-flash-lite (fast fallback)',
        };
      }
      throw primaryErr;
    }
  } catch (err: any) {
    console.error("Gemini API call failed, falling back to local engine:", err);
    return {
      text: `[Ornith Lokal Assistent]: Sky-tjenesten er midlertidig utilgjengelig (${err.message || 'spikestatus'}). Den lokale TinyML-motoren er fullt operativ og kjører 100% lokalt på din maskin. Du kan analysere datasettet, starte treninger, inspisere tapsfunksjoner og generere mikrokontroller-kode uten nettforbindelse.`,
      modelUsed: 'local-ornith-engine (fallback)',
    };
  }
}
