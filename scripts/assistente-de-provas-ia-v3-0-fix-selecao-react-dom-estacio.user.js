// ==UserScript==
// @name         Assistente de Provas IA v3.0 (Fix Seleção React + DOM Estácio)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Extrai perguntas e marca o gabarito disparando os handlers do React na plataforma da Estácio/Sala de Avaliações.
// @author       Você
// @match        *://*.estacio.br/*
// @match        *://*.wyden.com.br/*
// @match        *://*.saladeavaliacoes.com.br/*
// @connect      generativelanguage.googleapis.com
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://raw.githubusercontent.com/JpBllack/college/main/scripts/assistente-de-provas-ia-v3-0-fix-selecao-react-dom-estacio.user.js
// @downloadURL  https://raw.githubusercontent.com/JpBllack/college/main/scripts/assistente-de-provas-ia-v3-0-fix-selecao-react-dom-estacio.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // CONFIGURAÇÃO DE GERENCIAMENTO DE CHAVE DE API
    // ==========================================
    function obterApiKey() {
        let key = GM_getValue('gemini_api_key', '');
        if (!key || key.trim() === '') {
            key = prompt("Por favor, insira sua chave de API do Google AI Studio (Gemini):");
            if (key && key.trim() !== '') {
                key = key.trim();
                GM_setValue('gemini_api_key', key);
            } else {
                return null;
            }
        }
        return key;
    }

    GM_registerMenuCommand("Trocar chave de API", () => {
        const chaveAtual = GM_getValue('gemini_api_key', '');
        const novaChave = prompt("Insira a nova chave de API do Google AI Studio (Gemini):", chaveAtual);
        if (novaChave !== null) {
            GM_setValue('gemini_api_key', novaChave.trim());
            alert("Chave de API salva com sucesso!");
        }
    });

    // ==========================================
    // 1. CRIAÇÃO DA INTERFACE FLUTUANTE
    // ==========================================
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.padding = '8px 12px';
    container.style.background = '#1e1e1e';
    container.style.color = '#ffffff';
    container.style.borderRadius = '8px';
    container.style.zIndex = '999999';
    container.style.fontFamily = 'sans-serif';
    container.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    container.style.width = 'auto';
    container.style.transition = 'all 0.3s ease';

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; color: #4CAF50; display: none;" id="ia-titulo">🤖 IA Assistente v3.0</h3>
            <button id="btn-toggle-ia" style="background: #4CAF50; color: #000; border: 1px solid #555; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 12px; font-weight: bold;">🤖 Abrir IA</button>
        </div>

        <div id="ia-painel-conteudo" style="display: none; margin-top: 10px;">
            <textarea id="ia-texto-area" placeholder="O texto extraído aparecerá aqui..." style="width: 100%; height: 80px; margin-bottom: 10px; background: #2d2d2d; color: white; border: 1px solid #444; border-radius: 4px; padding: 5px; resize: vertical; box-sizing: border-box; font-size: 12px; font-family: inherit;"></textarea>

            <button id="btn-fluxo-completo" style="padding: 10px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; width: 100%; font-weight: bold; margin-bottom: 8px;">1. Extrair e Analisar (IA)</button>

            <div id="ia-resposta" style="margin-bottom: 10px; max-height: 180px; overflow-y: auto; font-size: 13px; border-top: 1px solid #444; border-bottom: 1px solid #444; padding: 10px 0; color: #aaa; white-space: pre-wrap;">Aguardando ação...</div>

            <button id="btn-marcar-respostas" style="padding: 10px; cursor: pointer; background: #FF9800; color: white; border: none; border-radius: 4px; width: 100%; font-weight: bold;" disabled>2. Marcar Gabarito na Tela</button>
        </div>
    `;

    document.body.appendChild(container);

    const txtArea = document.getElementById('ia-texto-area');
    const divResposta = document.getElementById('ia-resposta');
    const btnFluxo = document.getElementById('btn-fluxo-completo');
    const btnMarcar = document.getElementById('btn-marcar-respostas');
    const btnToggle = document.getElementById('btn-toggle-ia');
    const painelConteudo = document.getElementById('ia-painel-conteudo');
    const tituloIa = document.getElementById('ia-titulo');

    // ==========================================
    // CONFIGURAÇÃO DE MODELOS
    // ==========================================
    const modelosDisponiveis = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite'
    ];
    const MAX_TENTATIVAS_POR_MODELO = 3;

    let minimizado = true;

    btnToggle.addEventListener('click', () => {
        minimizado = !minimizado;
        if (minimizado) {
            painelConteudo.style.display = 'none';
            tituloIa.style.display = 'none';
            container.style.width = 'auto';
            container.style.padding = '8px 12px';
            btnToggle.innerText = '🤖 Abrir IA';
            btnToggle.style.background = '#4CAF50';
            btnToggle.style.color = '#000';
            btnToggle.style.fontWeight = 'bold';
        } else {
            painelConteudo.style.display = 'block';
            tituloIa.style.display = 'block';
            container.style.width = '320px';
            container.style.padding = '15px';
            btnToggle.innerText = '— Minimizar';
            btnToggle.style.background = '#333';
            btnToggle.style.color = '#fff';
            btnToggle.style.fontWeight = 'normal';
        }
    });

    // ==========================================
    // 2. FUNÇÃO DE EXTRAÇÃO
    // ==========================================
    function extrairQuestoes() {
        let resultado = "";
        const blocosQuestoes = document.querySelectorAll('[data-question-index]');

        if (blocosQuestoes.length === 0) {
            alert("Nenhuma questão encontrada na página. Verifique se a lista carregou.");
            return null;
        }

        blocosQuestoes.forEach((bloco, idx) => {
            const numeroQuestao = idx + 1;
            const perguntaDiv = bloco.querySelector('[data-testid="question-typography"]');
            if (!perguntaDiv) return;

            let textoPergunta = perguntaDiv.innerText.trim();
            resultado += `Questão ${numeroQuestao}:\n${textoPergunta}\n\n`;

            const botoesAlternativas = bloco.querySelectorAll('button[data-testid^="alternative-"]');
            botoesAlternativas.forEach((botao) => {
                const letra = botao.querySelector('[data-testid="circle-letter"]')?.innerText.trim() || "-";
                const textoAlternativa = botao.querySelector('.css-6fotmt [data-testid="question-typography"]')?.innerText.trim() || "";
                resultado += `${letra}) ${textoAlternativa}\n`;
            });

            resultado += `\n--------------------------------------------------\n\n`;
        });

        GM_setClipboard(resultado);
        return resultado;
    }

    // ==========================================
    // 3. COMUNICAÇÃO COM A IA
    // ==========================================
    function requisitarIA(instrucao, indexModelo = 0, tentativaAtual = 1) {
        const apiKey = obterApiKey();

        if (!apiKey) {
            btnFluxo.innerText = "1. Extrair e Analisar (IA)";
            btnFluxo.disabled = false;
            divResposta.style.color = "#ff4444";
            divResposta.innerText = "Erro: É necessário fornecer uma chave de API válida para continuar.";
            return;
        }

        if (indexModelo >= modelosDisponiveis.length) {
            btnFluxo.innerText = "1. Extrair e Analisar (IA)";
            btnFluxo.disabled = false;
            divResposta.style.color = "#ff4444";
            divResposta.innerText = "Erro: Todos os modelos esgotaram. Tente novamente mais tarde.";
            return;
        }

        const modeloAtual = modelosDisponiveis[indexModelo];
        const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modeloAtual}:generateContent`;

        divResposta.style.color = "#aaa";
        divResposta.innerText = `Consultando [${modeloAtual}] (Tentativa ${tentativaAtual}/${MAX_TENTATIVAS_POR_MODELO})...`;

        GM_xmlhttpRequest({
            method: "POST",
            url: endpointUrl,
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": apiKey
            },
            data: JSON.stringify({
                "contents": [{ "parts": [{ "text": instrucao }] }]
            }),
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);

                    if (res.candidates && res.candidates.length > 0) {
                        btnFluxo.innerText = "1. Extrair e Analisar (IA)";
                        btnFluxo.disabled = false;

                        const respostaIA = res.candidates[0].content.parts[0].text.trim();
                        divResposta.style.color = "#4CAF50";
                        divResposta.innerText = respostaIA;

                        if (respostaIA.includes("GABARITO_FINAL:")) {
                            btnMarcar.disabled = false;
                            btnMarcar.style.background = "#4CAF50";
                        } else {
                            alert("A IA respondeu, mas não gerou a tag GABARITO_FINAL. Leia a resposta manualmente.");
                        }
                    } else {
                        tratarFalha();
                    }
                } catch (err) {
                    tratarFalha();
                }
            },
            onerror: function() {
                tratarFalha();
            }
        });

        function tratarFalha() {
            if (tentativaAtual < MAX_TENTATIVAS_POR_MODELO) {
                setTimeout(() => {
                    requisitarIA(instrucao, indexModelo, tentativaAtual + 1);
                }, 1500);
            } else {
                requisitarIA(instrucao, indexModelo + 1, 1);
            }
        }
    }

    btnFluxo.addEventListener('click', () => {
        const textoExtraido = extrairQuestoes();

        if (!textoExtraido) return;

        txtArea.value = textoExtraido;
        btnFluxo.innerText = "Pensando... (Isso pode demorar)";
        btnFluxo.disabled = true;

        const instrucaoParaIA = `Você é um professor universitário especialista. Sua missão é resolver questões acadêmicas de múltipla escolha com precisão absoluta.

Para cada questão fornecida no texto abaixo, siga este processo obrigatoriamente:
1. Analise o contexto do enunciado.
2. Avalie cada alternativa individualmente, identificando o erro ou acerto técnico de cada uma.
3. Defina a alternativa correta com base em literatura e conceitos consolidados.

Após realizar essa análise para TODAS as questões, você deve gerar uma linha final isolada contendo OBRIGATORIAMENTE o formato exato:
GABARITO_FINAL: 1-A, 2-C, 3-D

Texto para analisar:
${textoExtraido}`;

        requisitarIA(instrucaoParaIA, 0, 1);
    });

    // ==========================================
    // 4. MARCADOR INTELIGENTE COMPATÍVEL COM REACT
    // ==========================================
    function simularCliqueReact(elemento) {
        if (!elemento) return;

        // Centraliza na visão
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Tenta acionar diretamente a propriedade interna de eventos do React (__reactProps$)
        // ✅ Como deve ficar:
        const reactKey = Object.keys(elemento).find(key => key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$'));
        if (reactKey && elemento[reactKey]) {
            if (typeof elemento[reactKey].onClick === 'function') {
                elemento[reactKey].onClick({
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    target: elemento,
                    currentTarget: elemento
                });
            }
        }

        // Dispara a cadeia completa de eventos DOM para garantir
        const eventos = [
            new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }),
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }),
            new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }),
            new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
        ];

        eventos.forEach(ev => elemento.dispatchEvent(ev));

        // Fallback Nativo
        if (typeof elemento.click === 'function') {
            elemento.click();
        }
    }

    btnMarcar.addEventListener('click', async () => {
        try {
            const textoGabarito = divResposta.innerText;

            const separador = "GABARITO_FINAL:";
            if (!textoGabarito.includes(separador)) {
                alert("Não encontrei a tag do gabarito final.");
                return;
            }

            const apenasRespostas = textoGabarito.split(separador)[1];
            const regex = /(\d+)[\s\-:)]+([A-E])/gi;
            const respostas = {};
            let match;

            while ((match = regex.exec(apenasRespostas)) !== null) {
                respostas[parseInt(match[1])] = match[2].toUpperCase();
            }

            if (Object.keys(respostas).length === 0) {
                alert("Não consegui extrair o formato das alternativas. Verifique o resultado gerado.");
                return;
            }

            const blocosQuestoes = document.querySelectorAll('[data-question-index]');
            let marcadas = 0;

            btnMarcar.disabled = true;
            btnMarcar.innerText = "Marcando...";

            for (let index = 0; index < blocosQuestoes.length; index++) {
                const bloco = blocosQuestoes[index];
                const numeroQuestao = index + 1;
                const letraCorreta = respostas[numeroQuestao];

                if (letraCorreta) {
                    const botoesAlternativas = bloco.querySelectorAll('button[data-testid^="alternative-"]');
                    for (const botao of botoesAlternativas) {
                        const letraElement = botao.querySelector('[data-testid="circle-letter"]');
                        if (letraElement) {
                            const letraBotao = letraElement.innerText.trim().toUpperCase();

                            if (letraBotao === letraCorreta) {
                                simularCliqueReact(botao);
                                marcadas++;
                                // Pausa para dar tempo ao estado do React atualizar
                                await new Promise(resolve => setTimeout(resolve, 500));
                                break;
                            }
                        }
                    }
                }
            }

            alert(`✅ Concluído! ${marcadas} questões foram marcadas.`);
        } catch (erro) {
            console.error("Erro ao marcar gabarito:", erro);
            alert("Ocorreu um erro durante a marcação. Verifique o console.");
        } finally {
            btnMarcar.disabled = false;
            btnMarcar.innerText = "2. Marcar Gabarito na Tela";
        }
    });

})();