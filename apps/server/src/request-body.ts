import type {IncomingMessage} from 'node:http';
export async function readJsonBody(req:IncomingMessage,limit=8192):Promise<unknown>{
 if(!req.headers['content-type']?.split(';')[0].trim().match(/^application\/json$/i))throw new Error('UNSUPPORTED_CONTENT_TYPE');
 let size=0;const chunks:Buffer[]=[];
 for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=data.length;if(size>limit)throw new Error('BODY_TOO_LARGE');chunks.push(data);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('INVALID_JSON');}
}
