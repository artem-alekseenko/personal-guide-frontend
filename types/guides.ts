export interface Guide {
  id: number;
  name: string;
  skills: string;
  avatar: string;
  context: string;
  tags: string[];
  tours: Tour[];
}

export interface IGuidesResponse {
  guides: Guide[];
}

export interface Tour {
  id: number;
  image: string;
  name: string;
  description: string;
  route: string;
  context: string;
  history: string[];
  status: string;
  settings: string[];
  tags: string[];
}
