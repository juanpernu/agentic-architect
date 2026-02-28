import { MercadoPagoConfig } from 'mercadopago';
import { env } from '../env';

let _client: MercadoPagoConfig | null = null;

export function getMPClient(): MercadoPagoConfig {
  if (!_client) {
    _client = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
    });
  }
  return _client;
}
