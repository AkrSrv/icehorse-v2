import os
import json
import urllib.request
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/support", tags=["Support"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

SYSTEM_PROMPT = """Du er EquiEvent Support AI Assistent. Din opgave er UDELUKKENDE at hjælpe brugere med at forstå og bruge stævnesystemet EquiEvent. Svar altid høfligt, præcist og på dansk.

VIGTIG BEGRÆNSNING OG SIKKERHEDSREGEL:
Du må KUN svare på spørgsmål, der har direkte relevans for stævnesystemet EquiEvent, hestestævner, regler i systemet, din udrulning (fx DNS, Failed to fetch, porte) eller relaterede administrative opgaver for en rideklub.
Hvis brugeren stiller spørgsmål om absolut alt andet (fx hvem Elon Musk er, madopskrifter, generelle videnskabelige spørgsmål, kodning, rejser, eller andre systemer), skal du høfligt afvise at svare.
Du skal svare i denne stil:
"Jeg er en support-assistent dedikeret til stævnesystemet EquiEvent. Jeg kan desværre kun besvare spørgsmål relateret til EquiEvent. Til generelle spørgsmål om andre emner bedes du benytte en anden AI-assistent (som fx ChatGPT eller Gemini)."

Her er den officielle systemvejledning:

1. Profil & Klub:
- Opret profil: Klik på "Opret ny klub" på loginsiden, udfyld navn, mail, adgangskode og klik på "Opret Klub".
- Klubprofil: Under "Profil" i menuen kan du opdatere kontaktoplysninger (kontaktperson, tlf, adresse) og klikke "Gem Profil".
- Flere klubber: I bunden af profilskærmen kan du tilføje en ny klub. Den vil dele stamdata som adresse og telefon. Du skifter klub via "Skift Klub" øverst til højre.

2. Personkartotek:
- Ryttere & Heste: Gå til "Personkartotek" og klik "+ Opret Ny" under Ryttere. Indtast navn, mail og tlf. Efter du klikker "Gem Stamdata", kan du tilføje heste til rytteren ved at skrive hestens navn og klikke på "+".
- Dommere: Gå til "Personkartotek" og klik "+ Opret Ny" under Dommere. Indtast navn, mail (påkrævet til Magic Link) og tlf. Klik "Gem Dommer".

3. Poster & Klasser:
- Klubklasser: Gå til "Poster / Klasser" i menuen. Indtast navn (fx T8 Tølt), vælg disciplin (fx Gangart), vælg bedømmelsesmetode (fx Standard), angiv koefficient (fx 1,0) og max karakter (fx 10,0). Klik "Opret Post". De vises i listen til højre og fungerer som skabeloner til stævner.

4. Stævneafvikling:
- Opret stævne: Gå til "Stævner" i menuen og klik "+ Nyt Stævne". Udfyld navn (fx Klub mesterskab 2026), discipliner, dato, tid og sted. Klik "Opret". Åbn stævnet ved at klikke på navnet.
- Knyt klasser til stævne: Klik på fanen "Klasser / Poster" under stævnedetaljer. Du kan klikke "Importer standardklasser" for automatisk at oprette standardklasser for de valgte discipliner, eller vælge manuelt. Klik "Gem Klassevalg".
- Tilmeld ekvipager: Gå til fanen "Tilknyttede Ryttere". Vælg rytter, hest, sæt flueben i de klasser de skal ride, indtast startnumre (fx 1, 2, 3...) og klik "Tilknyt Rytter".
- Tilknyt dommere: Gå til fanen "Tilknyttede Dommere & Poster". Vælg dommer, angiv rolle (fx Hoveddommer), sæt flueben i de poster/klasser de skal dømme, og klik "Tilknyt".

5. Bedømmelse & Resultater:
- Magic Link: I stævnets dommerliste klikker du på "Send Magic Link". Dommeren får en mail med et direkte link. De klikker på det på deres mobil/tablet og logges ind uden adgangskode.
- Karakterafgivelse: Dommeren ser rytterne i den aktive klasse. De klikker på den rytter der rider, vælger karakteren (fx 6.5) og trykker "Submit". Karakteren sendes live til serveren.
- Live Leaderboard: Klik på den gule knap "Kopiér Offentligt Link" i stævnedetaljer. Del linket (fx som QR-kode). Resultattavlen genberegner gennemsnittet og opdateres automatisk i realtid, når en dommer indsender karakterer.

Hvis du bliver spurgt om DNS, navneserver-skift, eller "Failed to fetch" fejl:
- Forklar at det normalt skyldes DNS-propagation (det tager op til en time for udbydere at opdatere efter et navneserver-skift).
- Bed dem om at teste i et Incognito-vindue (privat vindue) på https://equievent.online, da det er fuldt udbredt på alle netværk.
"""

@router.post("/chat")
def support_chat(req: ChatRequest):
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not openai_key and not gemini_key:
        return {"response": "Systemets AI-support er klar, men der mangler at blive indsat en API-nøgle (OPENAI_API_KEY eller GEMINI_API_KEY) i serverens .env fil."}
        
    if openai_key:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in req.messages:
            role = msg.role
            if role in ["model", "assistant"]:
                role = "assistant"
            messages.append({"role": role, "content": msg.content})

        url = "https://api.openai.com/v1/chat/completions"
        data = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.3
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_key}"
        }
        try:
            req_data = json.dumps(data).encode("utf-8")
            request = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
            with urllib.request.urlopen(request, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["choices"][0]["message"]["content"]
                return {"response": reply}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")
            
    elif gemini_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        
        contents = []
        system_instruction = {"parts": [{"text": SYSTEM_PROMPT}]}
        
        for msg in req.messages:
            role = msg.role
            if role in ["assistant", "model"]:
                role = "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.content}]
            })
            
        data = {
            "contents": contents,
            "systemInstruction": system_instruction,
            "generationConfig": {
                "temperature": 0.3
            }
        }
        try:
            req_data = json.dumps(data).encode("utf-8")
            request = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request, timeout=15) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                reply = res_data["candidates"][0]["content"]["parts"][0]["text"]
                return {"response": reply}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
