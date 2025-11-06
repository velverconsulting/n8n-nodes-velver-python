/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
export type RequestData = Record<string, unknown>;
const BASE_API_URL = 'https://api.velver.mx';

export default class CustomAxios {
	private client: AxiosInstance;
	constructor(config: AxiosRequestConfig) {
		this.client = axios.create({ ...(config ?? {}), baseURL: BASE_API_URL });
	}

	public async get(endpoint: string, data?: RequestData): Promise<AxiosResponse> {
		try {
			return await this.client.get(endpoint, { params: data });
		} catch (error) {
			console.error(`Error en GET ${endpoint}:`, error.message);
			throw error;
		}
	}

	public async post(endpoint: string, data?: RequestData): Promise<AxiosResponse> {
		try {
			return await this.client.post(endpoint, data);
		} catch (error) {
			console.error(`Error en POST ${endpoint}:`, error.message);
			throw error;
		}
	}
}
