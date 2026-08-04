export interface Channel {
  id: string;
  name: string;
  country: string;
  category: string;
  logo: string;
  streamUrl: string;
  language: string;
  isFavorite?: boolean;
  group?: string;
}

export interface ChannelsResponse {
  channels: Channel[];
  total: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}