import React from 'react';

const WHATSAPP_NUMBER = '24710440648';

const WhatsAppButton: React.FC = () => {
  const link = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Hi, I have a question about WorldTV.');

  return React.createElement(
    'a',
    {
      href: link,
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'fixed bottom-4 right-4 z-30 bg-green-600 hover:bg-green-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-2xl transition',
      'aria-label': 'Contact us on WhatsApp',
      title: 'Support, sales and inquiries',
    },
    'Chat with us'
  );
};

export default WhatsAppButton;