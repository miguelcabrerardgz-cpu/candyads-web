import { createChallenge, verifySolution, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { createHandler } from './core.mjs';

// El SDK de AWS viene incluido en el runtime de Lambda y usa las credenciales del rol de la función:
// no hay claves de AWS de larga duración.
const ses = new SESv2Client({});

const { handle, procesarRecordatorios } = createHandler({
  env: process.env,
  altcha: { createChallenge, verifySolution, randomInt, deriveKey },
  sendEmail: async ({ from, to, replyTo, subject, text, html }) => {
    const r = await ses.send(new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } }
        }
      }
    }));
    return { messageId: r.MessageId };
  }
});

// Misma Lambda, dos formas de invocarla: por su Function URL (petición HTTP normal, con
// requestContext.http) o directamente por una tarea programada de EventBridge (sin requestContext, con
// {tarea:'recordatorios'} como payload) que dispara los recordatorios de 15/30 días. EventBridge no pasa
// por la Function URL: invoca la función directamente, así que este es el único punto de entrada posible.
export const handler = async (event) => {
  if (event && event.tarea === 'recordatorios') {
    return procesarRecordatorios();
  }
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;
  let body = event.body || '';
  if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf8');
  return handle({
    method: event.requestContext.http.method,
    path: event.rawPath || '',
    headers,
    body,
    ip: event.requestContext.http.sourceIp
  });
};
