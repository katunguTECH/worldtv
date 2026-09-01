import React, { useState } from 'react';

const WHATSAPP_NUMBER = '254710440648';

const WHATSAPP_CHANNEL_LINK = 'https://whatsapp.com/channel/0029Vb8uRbRJf05g7kqSzf1Y';

const SUPPORT_LINK =
  'https://wa.me/' +
  WHATSAPP_NUMBER +
  '?text=' +
  encodeURIComponent('Hi, I have a question about WorldTV.');

// The single floating button now expands into two options: 1:1 support
// chat (original behavior) and joining the broadcast Channel (the actual
// lead-gen mechanism — unlike 1:1 chat, it scales to unlimited followers
// and lets you push updates to everyone at once).
const WhatsAppButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 w-56">
          <a
            href={WHATSAPP_CHANNEL_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white text-sm px-3 py-2 rounded hover:bg-gray-700"
          >
            📢 Join our Channel
          </a>
          <a
            href={SUPPORT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white text-sm px-3 py-2 rounded hover:bg-gray-700"
          >
            💬 Chat with support
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-green-600 hover:bg-green-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl transition"
        aria-label="WhatsApp options"
        title="Support, sales and inquiries"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
};

export default WhatsAppButton;
