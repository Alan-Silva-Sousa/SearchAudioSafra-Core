
export class CreateLogDto {
  userId: number;
  action: string;
  description: string;
  audioName?: string;
}