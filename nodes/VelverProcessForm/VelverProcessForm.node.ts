import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITaskMetadata,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionTypes,
	WAIT_INDEFINITELY,
} from 'n8n-workflow';
import { formProperties, handleFormWebhook, readConfig } from './utils/shared';

// El webhook es el de reanudación de la propia ejecución (restartWebhook, como el
// nodo Wait): no hay nada que registrar en un servicio externo, así que la regla
// de ciclo de vida de webhooks no aplica.
// Tampoco se ofrece como herramienta de agentes: pausa la ejecución esperando a
// una persona.
// eslint-disable-next-line @n8n/community-nodes/webhook-lifecycle-complete, @n8n/community-nodes/node-usable-as-tool
export class VelverProcessForm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Process Form',
		name: 'velverProcessForm',
		icon: 'file:VelverProcessForm.icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Genera un link y espera',
		description: 'Genera un link al formulario por etapas vc-process y espera a que lo envíen',
		defaults: { name: 'Velver Process Form' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		waitingNodeTooltip:
			'=El workflow continúa cuando se envíe el formulario en <a href="{{ $execution.resumeFormUrl }}" target="_blank">{{ $execution.resumeFormUrl }}</a>',
		// `nodeType: 'form'` es lo que hace de esto un FORMULARIO para n8n (igual que el
		// nodo Form): la página se sirve en /form-waiting/<ejecución>, el panel muestra
		// $execution.resumeFormUrl en vez de una URL de webhook, y el editor la abre sola
		// al ejecutar manualmente (ver setMetadata en execute). El POST es solo el envío
		// que hace la propia página; no es algo que haya que llamar a mano.
		webhooks: [
			{
				name: 'default',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				path: '',
				restartWebhook: true,
				isFullPath: true,
				nodeType: 'form',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				// Con «Esperar al workflow» la respuesta la manda n8n al TERMINAR la ejecución
				// (el JSON del último nodo); con «Mostrar mensaje» contesta el nodo al recibir.
				responseMode: '={{ $parameter["onSubmit"] === "wait" ? "lastNode" : "onReceived" }}',
				path: '',
				restartWebhook: true,
				isFullPath: true,
				nodeType: 'form',
				ndvHideUrl: true,
			},
		],
		properties: [
			{
				displayName:
					'Genera un link de un solo uso: <strong>$execution.resumeFormUrl</strong>. Al ejecutar desde el editor se abre solo; en producción, envíalo a quien capturará (correo, Telegram…) en un nodo ANTERIOR a este. Si el formulario debe INICIAR el workflow, usa Velver Process Form Trigger.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			...formProperties(
				'Valores con los que abre el formulario. Admite expresiones sobre el item de entrada.',
			),
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		readConfig(this);
		// Con esto el editor abre el formulario al quedar la ejecución en espera. Los
		// tipos de n8n-workflow 1.x no declaran `resumeFormUrl`, pero n8n 2.x lo lee
		// (es lo mismo que hace el nodo Form nativo).
		const resumeFormUrl = this.evaluateExpression('{{ $execution.resumeFormUrl }}', 0) as string;
		this.setMetadata({ resumeFormUrl } as ITaskMetadata);
		await this.putExecutionToWait(WAIT_INDEFINITELY);
		return [this.getInputData()];
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return await handleFormWebhook(this);
	}
}
