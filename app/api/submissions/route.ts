import { handleSubmissionUpload } from '@/lib/submission-upload';
export const runtime='nodejs';
export async function POST(request:Request){return handleSubmissionUpload(request);}
