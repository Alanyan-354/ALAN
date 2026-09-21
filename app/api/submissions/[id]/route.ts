import { handleSubmissionUpload } from '@/lib/submission-upload';
export const runtime='nodejs';
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return handleSubmissionUpload(request,(await params).id);}
