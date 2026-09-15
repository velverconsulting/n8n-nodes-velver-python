import {
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { formProperties, handleFormWebhook } from '../VelverProcessForm/utils/shared';

const FORM_PATH = '={{ $parameter["path"] || $webhookId }}';

// Los webhooks son rutas propias de n8n (/form y /form-test), no se registran en un
// servicio externo, así que la regla de ciclo de vida de webhooks no aplica.
// eslint-disable-next-line @n8n/community-nodes/webhook-lifecycle-complete
export class VelverProcessFormTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Process Form Trigger',
		name: 'velverProcessFormTrigger',
		icon: 'file:VelverProcessFormTrigger.icon.svg',
		group: ['trigger'],
		version: 1,
		subtitle: 'Inicia con el envío',
		description: 'Inicia el workflow cuando alguien envía el formulario por etapas vc-process',
		defaults: { name: 'Al enviar el formulario' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'velverFormPrefillApi',
				required: true,
				displayOptions: { show: { prefill: [true] } },
			},
		],
		// Misma forma que el Form Trigger de n8n: GET pinta la página y POST es el envío
		// que hace la propia página, en la misma URL (/form-test/<ruta> y /form/<ruta>).
		webhooks: [
			{
				name: 'setup',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				isFullPath: true,
				path: FORM_PATH,
				ndvHideUrl: true,
				nodeType: 'form',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				isFullPath: true,
				path: FORM_PATH,
				ndvHideMethod: true,
				nodeType: 'form',
			},
		],
		eventTriggerDescription: 'Esperando a que envíes el formulario',
		activationMessage: 'Ya puedes compartir la URL de producción del formulario.',
		triggerPanel: {
			header: 'Envía el formulario de prueba',
			executionsHelp: {
				inactive:
					'<b>Prueba:</b> pulsa «Execute step» y abre la URL de prueba del formulario (la ves arriba, en «Form URLs → Test URL»). El envío aparece aquí.<br /><br /><b>Producción:</b> publica el workflow y comparte la URL de producción; cada envío inicia una ejecución que verás en la lista de ejecuciones.',
				active:
					'<b>Prueba:</b> pulsa «Execute step» y abre la URL de prueba del formulario (la ves arriba, en «Form URLs → Test URL»). El envío aparece aquí.<br /><br /><b>Producción:</b> cada envío a la URL de producción inicia una ejecución que verás en la lista de ejecuciones.',
			},
			activationHint: {
				active:
					'Este nodo también se dispara con los envíos a la URL de producción (esas ejecuciones no aparecen aquí).',
				inactive:
					'Publica el workflow para que los envíos a la URL de producción lo inicien solos.',
			},
		},
		properties: [
			{
				displayName: 'Ruta Del Formulario',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'alta-cliente',
				description:
					'Último segmento de la URL: /form/&lt;ruta&gt; en producción y /form-test/&lt;ruta&gt; en prueba. Vacío = un identificador generado.',
			},
			{
				displayName: 'Permitir Pre-Relleno Cifrado',
				name: 'prefill',
				type: 'boolean',
				default: false,
				// La interfaz del nodo está en español; la regla pide empezar con «Whether».
				// eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
				description:
					'El formulario acepta un parámetro ?p= generado por el nodo Velver Form Prefill para pre-rellenar campos por enlace. En un campo deshabilitado, el valor pre-rellenado queda impuesto.',
			},
			{
				displayName:
					'Genera los enlaces con el nodo <strong>Velver Form Prefill</strong> usando la MISMA credencial. Un enlace alterado, de otra credencial o vencido muestra un aviso en vez del formulario.',
				name: 'prefillNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { prefill: [true] } },
			},
			...formProperties(
				'Valores con los que abre el formulario (no hay item de entrada: es el inicio del workflow)',
			),
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return await handleFormWebhook(this);
	}
}
