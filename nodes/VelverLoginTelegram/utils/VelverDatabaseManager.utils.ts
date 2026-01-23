/* eslint-disable @n8n/community-nodes/no-restricted-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Sequelize, QueryTypes, Options } from 'sequelize';
import SSH2Promise from 'ssh2-promise';

export interface VelverCredentials {
	dbType: 'mysql' | 'mariadb' | 'mssql' | 'postgres';
	host: string;
	database: string;
	user: string;
	password?: string;
	port: number;
	ssl: boolean;
	caCertificate?: string;
	rejectUnauthorized: boolean;
	useSsh: boolean;
	sshHost?: string;
	sshPort?: number;
	sshUser?: string;
	sshPassword?: string;
	sshPrivateKey?: string;
}

export class VelverDatabaseManager {
	private sequelize: Sequelize | null = null;
	private sshTunnel: any | null = null;
	private readonly credentials: VelverCredentials;
	public readonly motor: 'mysql' | 'mariadb' | 'mssql' | 'postgres';

	constructor(credentials: VelverCredentials) {
		this.credentials = credentials;
		this.motor = credentials.dbType;
	}

	private async ensureConnection(): Promise<void> {
		if (this.sequelize) {
			try {
				await this.sequelize.authenticate();
				return;
			} catch {
				await this.close();
			}
		}

		let host = this.credentials.host;
		let port = this.credentials.port;

		if (this.credentials.useSsh) {
			// Solución al error ts(2353): Forzamos el tipo como 'any' para la config de SSH
			const sshConfig: any = {
				host: this.credentials.sshHost,
				port: this.credentials.sshPort || 22,
				username: this.credentials.sshUser,
				password: this.credentials.sshPassword,
				privateKey: this.credentials.sshPrivateKey,
			};

			this.sshTunnel = new SSH2Promise(sshConfig);

			const tunnel = await this.sshTunnel.addTunnel({
				remoteAddr: this.credentials.host,
				remotePort: this.credentials.port,
			});

			host = '127.0.0.1';
			port = tunnel.localPort;
		}

		const sequelizeOptions: Options = {
			host,
			port,
			dialect: this.credentials.dbType,
			dialectOptions: this.getDialectOptions(),
			logging: false,
			pool: {
				max: 5,
				min: 0,
				acquire: 30000,
				idle: 20000, // Cierra conexiones inactivas tras 20s
				evict: 1000,
			},
		};

		this.sequelize = new Sequelize(
			this.credentials.database,
			this.credentials.user,
			this.credentials.password || '',
			sequelizeOptions,
		);

		await this.sequelize.authenticate();
	}

	private getDialectOptions(): Record<string, unknown> {
		const options: Record<string, unknown> = {};
		if (this.credentials.ssl) {
			if (this.credentials.dbType === 'mssql') {
				options.encrypt = true;
				options.trustServerCertificate = !this.credentials.rejectUnauthorized;
			} else {
				options.ssl = {
					ca: this.credentials.caCertificate,
					rejectUnauthorized: this.credentials.rejectUnauthorized,
				};
			}
		}
		return options;
	}

	async executeQuery<T = unknown>(sql: string, params: Record<string, unknown> = {}): Promise<T[]> {
		await this.ensureConnection();
		try {
			const results = await this.sequelize!.query(sql, {
				replacements: params,
				type: QueryTypes.SELECT,
			});
			return results as T[];
		} catch (error) {
			const message = error instanceof Error ? error.message : 'DB Error';
			throw new Error(`[VelverDatabaseManager] ${message}`);
		}
	}

	async close(): Promise<void> {
		if (this.sequelize) {
			await this.sequelize.close();
			this.sequelize = null;
		}
		if (this.sshTunnel) {
			try {
				await this.sshTunnel.close();
			} catch {
				// Ignorar errores al cerrar si ya estaba cerrado
			}
			this.sshTunnel = null;
		}
	}
}
