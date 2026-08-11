// support-chat.js - Indbygget AI-support chatbot widget til EquiEvent

(function() {
    // 1. Bestem API_BASE adresse dynamisk
    let API_BASE = 'https://api.equievent.dk';
    try {
        const host = window.location.hostname;
        if (host) {
            if (host.includes('equievent.online')) {
                API_BASE = 'https://api.equievent.online';
            } else if (host.includes('equievent.dk')) {
                API_BASE = 'https://api.equievent.dk';
            } else if (host.includes('alkdata.dk')) {
                API_BASE = 'https://api.alkdata.dk';
            } else {
                API_BASE = `http://${host}:8082`;
            }
        }
    } catch (e) {
        const host = window.location.hostname;
        if (host) {
            API_BASE = `http://${host}:8082`;
        }
    }

    // 2. Indsæt CSS stilarter i head
    const style = document.createElement('style');
    style.innerHTML = `
        /* Chat bubble trigger knap */
        .eq-support-trigger {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #f43f5e;
            color: #ffffff;
            border: none;
            box-shadow: 0 4px 16px rgba(244, 63, 94, 0.4);
            cursor: pointer;
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1.5rem;
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s;
        }
        .eq-support-trigger:hover {
            transform: scale(1.08) translateY(-2px);
            background: #e11d48;
        }
        .eq-support-trigger:active {
            transform: scale(0.95);
        }

        /* Chat vindue container */
        .eq-support-window {
            position: fixed;
            bottom: 96px;
            right: 24px;
            width: 380px;
            height: 520px;
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
            z-index: 9998;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15);
        }
        .eq-support-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
        }

        /* Chat Header */
        .eq-support-header {
            padding: 1.2rem 1.5rem;
            background: rgba(30, 41, 59, 0.7);
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .eq-support-header-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .eq-support-header-info i {
            color: #f43f5e;
            font-size: 1.25rem;
        }
        .eq-support-header-info h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 700;
            color: #ffffff;
        }
        .eq-support-header-info span {
            font-size: 0.75rem;
            color: #10b981;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .eq-support-header-info span::before {
            content: '';
            width: 6px;
            height: 6px;
            background: #10b981;
            border-radius: 50%;
            display: inline-block;
        }
        .eq-support-close {
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 1.1rem;
            transition: color 0.2s;
        }
        .eq-support-close:hover {
            color: #ffffff;
        }

        /* Meddelelsesliste */
        .eq-support-messages {
            flex: 1;
            padding: 1.5rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* Beskeder */
        .eq-msg {
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 0.9rem;
            line-height: 1.45;
            word-wrap: break-word;
        }
        .eq-msg-bot {
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.08);
            color: #f1f5f9;
            border-top-left-radius: 4px;
        }
        .eq-msg-user {
            align-self: flex-end;
            background: #f43f5e;
            color: #ffffff;
            border-top-right-radius: 4px;
        }

        /* Indtastningsfelt */
        .eq-support-input-area {
            padding: 1rem;
            background: rgba(15, 23, 42, 0.6);
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            gap: 8px;
        }
        .eq-support-input {
            flex: 1;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 10px 14px;
            color: #ffffff;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.2s;
        }
        .eq-support-input:focus {
            border-color: #f43f5e;
        }
        .eq-support-send {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: #f43f5e;
            color: #ffffff;
            border: none;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 1rem;
            transition: background 0.2s;
        }
        .eq-support-send:hover {
            background: #e11d48;
        }

        /* Typing indicator */
        .eq-typing {
            display: flex;
            gap: 4px;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 14px;
            border-top-left-radius: 4px;
            align-self: flex-start;
            width: fit-content;
        }
        .eq-typing-dot {
            width: 6px;
            height: 6px;
            background: #94a3b8;
            border-radius: 50%;
            animation: eq-bounce 1.4s infinite ease-in-out both;
        }
        .eq-typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .eq-typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes eq-bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
        }

        /* Mobiloptimering */
        @media (max-width: 480px) {
            .eq-support-window {
                width: calc(100% - 32px);
                height: 480px;
                bottom: 84px;
                right: 16px;
            }
            .eq-support-trigger {
                bottom: 16px;
                right: 16px;
            }
        }
    `;
    document.head.appendChild(style);

    // 3. Opret og indsæt DOM-elementer i body
    const trigger = document.createElement('button');
    trigger.className = 'eq-support-trigger';
    trigger.setAttribute('title', 'Kontakt Support');
    trigger.innerHTML = '<i class="fas fa-comments"></i>';

    const windowContainer = document.createElement('div');
    windowContainer.className = 'eq-support-window';
    windowContainer.innerHTML = `
        <div class="eq-support-header">
            <div class="eq-support-header-info">
                <i class="fas fa-horse-head"></i>
                <div>
                    <h4>EquiEvent Support</h4>
                    <span>AI Assistent</span>
                </div>
            </div>
            <button class="eq-support-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="eq-support-messages" id="eq-chat-messages">
            <div class="eq-msg eq-msg-bot">
                Hej! Jeg er din EquiEvent Support AI-assistent. Hvordan kan jeg hjælpe dig i dag? (fx med opsætning af stævne, dommere eller personkartotek).
            </div>
        </div>
        <div class="eq-support-input-area">
            <input type="text" class="eq-support-input" id="eq-chat-input" placeholder="Skriv et spørgsmål...">
            <button class="eq-support-send" id="eq-chat-send"><i class="fas fa-paper-plane"></i></button>
        </div>
    `;

    document.body.appendChild(trigger);
    document.body.appendChild(windowContainer);

    // 4. Chat Logik
    const chatInput = document.getElementById('eq-chat-input');
    const sendBtn = document.getElementById('eq-chat-send');
    const msgContainer = document.getElementById('eq-chat-messages');
    const closeBtn = windowContainer.querySelector('.eq-support-close');

    let chatHistory = []; // Gemmer samtalehistorik [{role: 'user'|'model', content: '...'}]

    // Toggle vindue åben/lukket
    trigger.addEventListener('click', () => {
        const isOpen = windowContainer.classList.toggle('open');
        if (isOpen) {
            chatInput.focus();
            trigger.innerHTML = '<i class="fas fa-chevron-down"></i>';
        } else {
            trigger.innerHTML = '<i class="fas fa-comments"></i>';
        }
    });

    closeBtn.addEventListener('click', () => {
        windowContainer.classList.remove('open');
        trigger.innerHTML = '<i class="fas fa-comments"></i>';
    });

    // Send besked funktion
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Tilføj brugerens besked til chatten og historik
        appendMessage(text, 'user');
        chatHistory.push({ role: 'user', content: text });
        chatInput.value = '';

        // Tilføj typing indicator
        const typingIndicator = showTypingIndicator();

        try {
            // Kald din FastAPI backend support endepunkt
            const response = await fetch(`${API_BASE}/support/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: chatHistory
                })
            });

            // Fjern typing indicator
            typingIndicator.remove();

            if (response.ok) {
                const data = await response.json();
                const reply = data.response;
                appendMessage(reply, 'bot');
                chatHistory.push({ role: 'assistant', content: reply });
            } else {
                appendMessage('Beklager, jeg kunne ikke forbinde til supportserveren lige nu. Prøv igen om et øjeblik.', 'bot');
            }
        } catch (error) {
            typingIndicator.remove();
            appendMessage('Forbindelsesfejl. Kontroller venligst at du har internetforbindelse og prøv igen.', 'bot');
        }
    }

    // Tilføj besked til DOM og scroll til bunden
    function appendMessage(text, sender) {
        const msg = document.createElement('div');
        msg.className = `eq-msg eq-msg-${sender}`;
        
        // Konverter simple linjeskift til <br> og bevar formatering
        msg.innerHTML = text.replace(/\n/g, '<br>');
        msgContainer.appendChild(msg);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    // Vis typing indicator
    function showTypingIndicator() {
        const loader = document.createElement('div');
        loader.className = 'eq-typing';
        loader.innerHTML = `
            <div class="eq-typing-dot"></div>
            <div class="eq-typing-dot"></div>
            <div class="eq-typing-dot"></div>
        `;
        msgContainer.appendChild(loader);
        msgContainer.scrollTop = msgContainer.scrollHeight;
        return loader;
    }

    // Event listeners til input og knapper
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

})();
