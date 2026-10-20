import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

const OPS = ['create', 'getStatus', 'getEvents', 'downloadFinal', 'cancel'];

export class VelverSign implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Velver Sign',
		name: 'velverSign',
		icon: 'file:VelverSign.icon.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Solicita firmas electrónicas sobre un PDF y consulta su avance',
		defaults: { name: 'Velver Sign' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'velverSignApi', required: true }],
		properties: [
			{
				displayName: 'Operación',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Crear Solicitud', value: 'create', action: 'Crear una solicitud de firma' },
					{ name: 'Obtener Estado', value: 'getStatus', action: 'Obtener el estado de una solicitud' },
					{ name: 'Obtener Bitácora', value: 'getEvents', action: 'Obtener la bitácora de auditoría' },
					{
						name: 'Descargar Documento Final',
						value: 'downloadFinal',
						action: 'Descargar el PDF final firmado',
					},
					{ name: 'Cancelar Solicitud', value: 'cancel', action: 'Cancelar una solicitud' },
				],
				default: 'create',
			},
			{
				displayName: 'Origen Del PDF',
				name: 'pdfSource',
				type: 'options',
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{ name: 'Binario Del Item', value: 'binary' },
					{ name: 'Base64', value: 'base64' },
				],
				default: 'binary',
			},
			{
				displayName: 'Propiedad Binaria',
				name: 'binaryProperty',
				type: 'string',
				default: 'data_pdf',
				displayOptions: { show: { operation: ['create'], pdfSource: ['binary'] } },
				description: 'Nombre de la propiedad binaria del item que contiene el PDF',
			},
			{
				displayName: 'PDF En Base64',
				name: 'pdfBase64',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['create'], pdfSource: ['base64'] } },
			},
			{
				displayName: 'Título',
				name: 'title',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['create'] } },
			},
			{
				displayName: 'Firmantes',
				name: 'signers',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Agregar firmante',
				default: {},
				displayOptions: { show: { operation: ['create'] } },
				options: [
					{
						name: 'items',
						displayName: 'Firmante',
						values: [
							{ displayName: 'Nombre', name: 'name', type: 'string', default: '' },
							{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'nombre@correo.com', default: '' },
							{ displayName: 'Teléfono', name: 'phone', type: 'string', default: '' },
							{
								displayName: 'Orden',
								name: 'order',
								type: 'number',
								typeOptions: { minValue: 1 },
								default: 1,
								description: 'Orden de firma (entero positivo)',
							},
						],
					},
				],
			},
			{
				displayName: 'Caducidad (Días)',
				name: 'expiresInDays',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 7,
				displayOptions: { show: { operation: ['create'] } },
			},
			{
				displayName: 'ID De Solicitud',
				name: 'requestId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getStatus', 'getEvents', 'downloadFinal', 'cancel'] } },
			},
			{
				displayName: 'Propiedad Binaria De Salida',
				name: 'outputProperty',
				type: 'string',
				default: 'data_signed_pdf',
				displayOptions: { show: { operation: ['downloadFinal'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const cred = await this.getCredentials('velverSignApi');
		const baseUrl = String(cred.baseUrl ?? '').replace(/\/+$/, '');
		const apiKey = String(cred.apiKey ?? '');
		if (!baseUrl) throw new NodeOperationError(this.getNode(), 'La credencial no tiene URL base');

		const call = async (opts: Partial<IHttpRequestOptions> & { path: string }) => {
			const { path, ...rest } = opts;
			return this.helpers.httpRequest({
				url: `${baseUrl}${path}`,
				headers: { 'x-api-key': apiKey },
				...rest,
			} as IHttpRequestOptions);
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				if (!OPS.includes(operation)) {
					throw new NodeOperationError(this.getNode(), `Operación desconocida: ${operation}`, { itemIndex: i });
				}

				if (operation === 'create') {
					let pdfBase64: string;
					if (this.getNodeParameter('pdfSource', i) === 'binary') {
						const prop = this.getNodeParameter('binaryProperty', i) as string;
						if (!items[i].binary?.[prop]) {
							throw new NodeOperationError(this.getNode(), `El item no tiene la propiedad binaria «${prop}»`, {
								itemIndex: i,
							});
						}
						pdfBase64 = (await this.helpers.getBinaryDataBuffer(i, prop)).toString('base64');
					} else {
						pdfBase64 = (this.getNodeParameter('pdfBase64', i) as string).replace(/^data:[^,]*,/, '').trim();
					}
					if (!pdfBase64) throw new NodeOperationError(this.getNode(), 'El PDF está vacío', { itemIndex: i });

					const raw = (this.getNodeParameter('signers', i, {}) as IDataObject).items as IDataObject[] | undefined;
					const signers = (raw ?? []).map((s) => {
						const order = Number(s.order);
						return {
							name: String(s.name ?? ''),
							email: String(s.email ?? ''),
							...(s.phone ? { phone: String(s.phone) } : {}),
							...(Number.isInteger(order) && order > 0 ? { order } : {}),
						};
					});
					if (!signers.length) {
						throw new NodeOperationError(this.getNode(), 'Agrega al menos un firmante', { itemIndex: i });
					}
					const days = Number(this.getNodeParameter('expiresInDays', i));
					const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();

					const res = (await call({
						path: '/requests',
						method: 'POST',
						json: true,
						body: { pdfBase64, title: this.getNodeParameter('title', i) as string, signers, expiresAt },
					})) as IDataObject;
					// Los enlaces de firma solo vienen en esta respuesta.
					out.push({ json: res, pairedItem: { item: i } });
					continue;
				}

				const id = encodeURIComponent((this.getNodeParameter('requestId', i) as string).trim());
				if (!id) throw new NodeOperationError(this.getNode(), 'Falta el ID de la solicitud', { itemIndex: i });

				if (operation === 'getStatus') {
					const res = (await call({ path: `/requests/${id}`, method: 'GET', json: true })) as IDataObject;
					out.push({ json: res, pairedItem: { item: i } });
				} else if (operation === 'getEvents') {
					const res = (await call({ path: `/requests/${id}/events`, method: 'GET', json: true })) as IDataObject;
					out.push({ json: res, pairedItem: { item: i } });
				} else if (operation === 'cancel') {
					const res = (await call({ path: `/requests/${id}/cancel`, method: 'POST', json: true })) as IDataObject;
					out.push({ json: res, pairedItem: { item: i } });
				} else {
					const status = (await call({ path: `/requests/${id}`, method: 'GET', json: true })) as IDataObject;
					if (status.status !== 'completed') {
						throw new NodeOperationError(
							this.getNode(),
							`La solicitud aún no está completada (estatus: ${String(status.status)}); el PDF final no está disponible`,
							{ itemIndex: i },
						);
					}
					const buf = (await call({
						path: `/requests/${id}/final.pdf`,
						method: 'GET',
						encoding: 'arraybuffer',
						json: false,
					})) as ArrayBuffer | Buffer;
					const prop = this.getNodeParameter('outputProperty', i) as string;
					const data = await this.helpers.prepareBinaryData(Buffer.from(buf as ArrayBuffer), 'firmado.pdf', 'application/pdf');
					out.push({
						json: { requestId: decodeURIComponent(id), status: 'completed' },
						binary: { [prop]: data },
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
