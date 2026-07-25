// Lightweight custom element wrapper to embed the DesignInc chatbot as an iframe.
// Drop this file at your Script URL (e.g., https://designinchatbot.vercel.app/widget.js).
(() => {
  if (customElements.get('chatbot-widget')) return;

  class ChatbotWidget extends HTMLElement {
    connectedCallback() {
      // Allow overriding the iframe source via attribute `src` or `data-src`.
      const src =
        this.getAttribute('src') ||
        this.getAttribute('data-src') ||
        'https://designinchatbot.vercel.app/';

      // Optional: allow pointer-events passthrough by setting data-transparent="true"
      const transparent = this.getAttribute('data-transparent') === 'true';
      const minHeight = this.getAttribute('data-min-height') || '700px';
      const minWidth = this.getAttribute('data-min-width') || '320px';

      const shadow = this.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: ${minHeight};
          min-width: ${minWidth};
        }
        iframe {
          border: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          ${transparent ? 'pointer-events: none;' : ''}
        }
      `;

      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.allow = 'clipboard-write; microphone; camera';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('title', 'DesignInc Chatbot');

      shadow.append(style, iframe);
    }
  }

  customElements.define('chatbot-widget', ChatbotWidget);
})();
