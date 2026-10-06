// ==UserScript==
// @name         Remover IA / Chat Estácio
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Remove o widget de IA/chat da YDUQS/Estácio da tela da Sala de Aula Virtual.
// @author       Você
// @match        *://*.estacio.br/*
// @match        *://*.wyden.com.br/*
// @match        *://*.saladeavaliacoes.com.br/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/JpBllack/college/main/scripts/remover-ia-chat-estacio.user.js
// @downloadURL  https://raw.githubusercontent.com/JpBllack/college/main/scripts/remover-ia-chat-estacio.user.js
// ==/UserScript==

(function() {
    'use strict';

    // 1. Injeta CSS reforçado para ocultar containers e componentes do chat
    const styleBlock = document.createElement('style');
    styleBlock.innerHTML = `
        iframe[src*="yduqs"],
        div[id*="yduqs"],
        div[class*="yduqs"],
        div[class*="chat-lib"],
        #chat-lib-container,
        [data-testid*="chat"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `;

    if (document.head) {
        document.head.appendChild(styleBlock);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(styleBlock));
    }

    // 2. Observador para deletar scripts e elementos dinâmicos do chat assim que tentarem entrar no DOM
    const observer = new MutationObserver(() => {
        // Remove o script da biblioteca do chat
        const chatScript = document.querySelector('script[src*="yduqs-chat-lib"]');
        if (chatScript) {
            chatScript.remove();
        }

        // Deleta elementos ou iframes criados pelo chat
        const chatElements = document.querySelectorAll('[id*="yduqs-chat"], [class*="yduqs-chat"], iframe[src*="yduqs"]');
        chatElements.forEach(el => el.remove());
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
})();