// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · channel contracts (STEP 6).
//
// A Channel is how an experience reaches a surface (Website, Customer App, …). Each channel
// is a DESCRIPTOR the engine reads — it supplies a schema kind, a render target, navigation,
// permissions, publishing and analytics. INTERFACES ONLY; no channel is implemented here.
// Existing runtimes are wrapped as adapters in later waves, never rewritten.
// ─────────────────────────────────────────────────────────────────────────────
import type { ChannelId, RoleId } from './types';
import type { ChannelMetadata } from './metadata';
import type {
  BaseExperienceSchema, WebsiteSchema, CustomerSchema, DriverSchema,
  MerchantSchema, AffiliateSchema, PartnerSchema, AdminSchema,
} from './schema';

/** The contract every channel satisfies. `Schema` binds the channel to its schema shape. */
export interface ChannelContract<Schema extends BaseExperienceSchema = BaseExperienceSchema> {
  readonly id: ChannelId;
  readonly metadata: ChannelMetadata;
  /** The render target this channel emits to (matches a RenderingPort.target). */
  readonly renderTarget: string;
  /** Roles allowed to receive experiences on this channel. */
  readonly roles: RoleId[];
  /** Whether the channel supports authored navigation. */
  readonly hasNavigation: boolean;
  /** Whether the channel participates in the publishing lifecycle. */
  readonly publishable: boolean;
  /** Phantom marker binding the channel to its schema type (no runtime cost). */
  readonly __schema?: Schema;
}

export interface WebsiteChannel extends ChannelContract<WebsiteSchema> { readonly id: 'website' }
export interface CustomerChannel extends ChannelContract<CustomerSchema> { readonly id: 'customer' }
export interface DriverChannel extends ChannelContract<DriverSchema> { readonly id: 'driver' }
export interface MerchantChannel extends ChannelContract<MerchantSchema> { readonly id: 'merchant' }
export interface AffiliateChannel extends ChannelContract<AffiliateSchema> { readonly id: 'affiliate' }
export interface PartnerChannel extends ChannelContract<PartnerSchema> { readonly id: 'partner' }
export interface AdminChannel extends ChannelContract<AdminSchema> { readonly id: 'admin' }

/** Any registered channel. */
export type AnyChannel =
  | WebsiteChannel | CustomerChannel | DriverChannel | MerchantChannel
  | AffiliateChannel | PartnerChannel | AdminChannel | ChannelContract;
