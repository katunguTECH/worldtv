import React, { useState } from 'react';

interface ShareButtonsProps {
  country?: string;
  channelName?: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({
  country,
  channelName,
}) => {
  const [copied, setCopied] = useState(false);

  const cleanCountry = country?.trim() || '';

  // Convert "Kenya" -> "Kenyan"
  const getCountryAdjective = (value: string) => {
    const adjectives: Record<string, string> = {
      Kenya: 'Kenyan',
      Nigeria: 'Nigerian',
      'South Africa': 'South African',
      Ghana: 'Ghanaian',
      Uganda: 'Ugandan',
      Tanzania: 'Tanzanian',
      Ethiopia: 'Ethiopian',
      Rwanda: 'Rwandan',
      Burundi: 'Burundian',
      Zambia: 'Zambian',
      Zimbabwe: 'Zimbabwean',
      Malawi: 'Malawian',
      Mozambique: 'Mozambican',
      Botswana: 'Botswanan',
      Namibia: 'Namibian',
      Lesotho: 'Basotho',
      Eswatini: 'Swazi',
      Egypt: 'Egyptian',
      Morocco: 'Moroccan',
      Algeria: 'Algerian',
      Tunisia: 'Tunisian',
      Senegal: 'Senegalese',
      Cameroon: 'Cameroonian',
      'Ivory Coast': 'Ivorian',
      France: 'French',
      Germany: 'German',
      Italy: 'Italian',
      Spain: 'Spanish',
      Portugal: 'Portuguese',
      Netherlands: 'Dutch',
      Belgium: 'Belgian',
      Canada: 'Canadian',
      'United States': 'American',
      Mexico: 'Mexican',
      Brazil: 'Brazilian',
      Argentina: 'Argentine',
      Colombia: 'Colombian',
      Peru: 'Peruvian',
      India: 'Indian',
      Pakistan: 'Pakistani',
      Bangladesh: 'Bangladeshi',
      Japan: 'Japanese',
      'South Korea': 'South Korean',
      China: 'Chinese',
      Australia: 'Australian',
      'New Zealand': 'New Zealand',
      Singapore: 'Singaporean',
      Malaysia: 'Malaysian',
      Philippines: 'Filipino',
      Indonesia: 'Indonesian',
      Thailand: 'Thai',
      Vietnam: 'Vietnamese',
      Turkey: 'Turkish',
      Israel: 'Israeli',
      'Saudi Arabia': 'Saudi Arabian',
      'United Arab Emirates': 'Emirati',
      Greece: 'Greek',
      Poland: 'Polish',
      Sweden: 'Swedish',
      Norway: 'Norwegian',
      Denmark: 'Danish',
      Finland: 'Finnish',
      Russia: 'Russian',
    };

    return adjectives[value] || value;
  };

  const adjective = getCountryAdjective(cleanCountry);

  const countryPath = cleanCountry
    ? cleanCountry
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    : '';

  const shareUrl = countryPath
    ? `https://worldtvchannel.online/tv/${countryPath}`
    : 'https://worldtvchannel.online/';

  const shareText = channelName
    ? `🇺🇳 Watching ${channelName} on WorldTV? Share it with someone who would love it! 🌍`
    : cleanCountry
      ? `🌍 Missing ${adjective} TV? Watch it free on WorldTV: ${shareUrl}`
      : `🌍 Watch live TV channels from around the world on WorldTV: ${shareUrl}`;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const whatsappUrl = `https://wa.me/?text=${encodedText}`;

  const facebookUrl =
    `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  const xUrl =
    `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Unable to copy link:', error);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gray-900/60 border border-gray-700 rounded-lg">
      <div className="mb-3">
        <div className="text-white font-semibold">
          Enjoying WorldTV?
        </div>

        <div className="text-gray-400 text-sm mt-1">
          Share it with someone who misses TV from home 🌍
        </div>
      </div>

      <div className="text-gray-500 text-xs mb-3 break-all">
        {shareUrl}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.open(
            whatsappUrl,
            '_blank',
            'noopener,noreferrer'
          )}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => window.open(
            facebookUrl,
            '_blank',
            'noopener,noreferrer'
          )}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span>Facebook</span>
        </button>

        <button
          type="button"
          onClick={() => window.open(
            xUrl,
            '_blank',
            'noopener,noreferrer'
          )}
          className="bg-black hover:bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span>𝕏</span>
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <span>{copied ? 'Copied ✓' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  );
};

export default ShareButtons;