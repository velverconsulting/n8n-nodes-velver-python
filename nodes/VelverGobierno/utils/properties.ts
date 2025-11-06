/* eslint-disable n8n-nodes-base/node-param-options-type-unsorted-items */
import { INodeTypeDescription } from 'n8n-workflow';
export const properties: INodeTypeDescription['properties'] = [
	{
		displayName: 'Author',
		name: 'author',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		placeholder: 'Author...',
		description: "Type de author's name provided by Velver Consulting",
	},
	{
		displayName: 'Operation Type',
		name: 'validationType',
		type: 'options',
		default: 'curp',
		options: [
			{
				name: 'CURP',
				value: 'curp',
				description: '-> RENAPO',
			},
			{
				name: 'RFC',
				value: 'rfc',
				description: '-> SAT',
			},
			{
				name: 'Factura',
				value: 'invoice',
				description: '-> SAT',
			},
			{
				name: 'Constancia De Situación Fiscal',
				value: 'csf',
				description: '-> SAT',
			},
			{
				name: 'INE',
				value: 'ine',
				description: '-> RENAPO & INE',
			},
		],
		placeholder: 'Choose the validation mode...',
	},
	{
		displayName: 'Value',
		name: 'valValue',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['curp', 'rfc'],
			},
		},
		placeholder: 'Value to validate...',
		description: 'The value to validate with',
	},
	{
		displayName: 'Base64',
		name: 'valBase64',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['invoice', 'csf'],
			},
		},
		placeholder: 'File to validate...',
		description: 'Raw base64 file',
	},
	{
		displayName: 'MimeType',
		name: 'mimeType',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['invoice', 'csf'],
			},
		},
		placeholder: 'File mimetype (optional)...',
		description: 'File mimetype e.g. application/xml',
	},
	{
		displayName: 'Stage',
		name: 'ineStage',
		type: 'options',
		default: 'start',
		displayOptions: {
			show: {
				validationType: ['ine'],
			},
		},
		options: [
			{
				name: 'Start',
				value: 'start',
				description: 'Flow start',
			},
			{
				name: 'Validate',
				value: 'revalidate',
				description: 'Flow fallback',
			},
		],
		placeholder: 'Choose the validation mode...',
	},
	{
		displayName: 'INE Front',
		name: 'ineFront',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['ine'],
				ineStage: ['start'],
			},
		},
		placeholder: 'Front side base64...',
		description: 'Base64 of the image of the front side of the credential',
	},
	{
		displayName: 'INE Back',
		name: 'ineBack',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['ine'],
				ineStage: ['start'],
			},
		},
		placeholder: 'Back side base64...',
		description: 'Base64 of the image of the back side of the credential',
	},
	{
		displayName: 'Previous Data',
		name: 'prevData',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['ine'],
				ineStage: ['revalidate'],
			},
		},
		placeholder: 'Previous results json...',
		description: 'The',
	},
	{
		displayName: 'CURP Validation',
		name: 'prevCURP',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['ine'],
				ineStage: ['revalidate'],
			},
		},
		placeholder: 'Correct CURP json...',
		description: 'The correct CURP field',
	},
	{
		displayName: 'QR Code Validation',
		name: 'newQR',
		type: 'string',
		default: '',
		typeOptions: {
			rows: 1,
		},
		displayOptions: {
			show: {
				validationType: ['ine'],
				ineStage: ['revalidate'],
			},
		},
		placeholder: 'Correct QR code value...',
		description: 'The correct QR code field',
	},
	{
		displayName: 'Additional Parameters',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Parameter',
		default: {},
		options: [
			{
				displayName: 'Auth Type',
				name: 'authType',
				type: 'options',
				default: 'author',
				options: [
					{
						name: 'Author Based',
						value: 'author',
					},
					{
						name: 'Admin Based',
						value: 'admin',
					},
				],
				placeholder: 'Auth mode...',
				description: 'Choose de authentication mode',
			},
		],
	},
];
