import { IExecuteFunctions, IWebhookFunctions } from 'n8n-workflow';

export type FormContext = IExecuteFunctions | IWebhookFunctions;

/**
 * Lee un parámetro del nodo en cualquiera de los dos contextos: al ejecutar,
 * `getNodeParameter` recibe el índice del item; en un webhook no (su segundo
 * argumento ya es el valor de respaldo).
 */
export function param<T>(ctx: FormContext, name: string, fallback: T): T {
	if ('getRequestObject' in ctx) return ctx.getNodeParameter(name, fallback as never) as T;
	return ctx.getNodeParameter(name, 0, fallback as never) as T;
}
