// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW canonical data models (Phase 9D).
//
// The complete, HAAT-ONLY entity schema (no Beauty Hub, no Dynamic Logistics, no external
// project). One-click installable into the Data Platform. Pure factory — builds Entity + Relation
// objects for the 9C data model; ids are generated per install so relations wire by name.
// ─────────────────────────────────────────────────────────────────────────────
import { did, type Entity, type Relation, type FieldType, type Field, type RelationType } from './dataModel';

type FSpec = [string, FieldType];
interface ESpec { name: string; icon: string; color: string; fields: FSpec[]; }

// name → [field, type]. Only HAAT NOW domain entities.
const SPECS: ESpec[] = [
  { name: 'Restaurants', icon: 'Store', color: '#a3f95b', fields: [['id', 'uuid'], ['name', 'text'], ['logo', 'image'], ['rating', 'rating'], ['cuisine', 'enum'], ['active', 'boolean'], ['createdAt', 'timestamp']] },
  { name: 'Branches', icon: 'MapPin', color: '#5ad1ff', fields: [['id', 'uuid'], ['name', 'text'], ['restaurant', 'reference'], ['phone', 'phone'], ['isOpen', 'boolean'], ['location', 'geopoint']] },
  { name: 'Categories', icon: 'Tag', color: '#c78bff', fields: [['id', 'uuid'], ['name', 'text'], ['icon', 'image'], ['order', 'integer'], ['active', 'boolean']] },
  { name: 'Products', icon: 'ShoppingBag', color: '#ffb454', fields: [['id', 'uuid'], ['name', 'text'], ['branch', 'reference'], ['category', 'reference'], ['price', 'currency'], ['image', 'image'], ['available', 'boolean']] },
  { name: 'Variants', icon: 'Layers', color: '#ff8f8f', fields: [['id', 'uuid'], ['product', 'reference'], ['name', 'text'], ['priceDelta', 'currency']] },
  { name: 'Modifiers', icon: 'Sliders', color: '#7dd3fc', fields: [['id', 'uuid'], ['product', 'reference'], ['name', 'text'], ['price', 'currency'], ['required', 'boolean']] },
  { name: 'Merchants', icon: 'Store', color: '#a3f95b', fields: [['id', 'uuid'], ['name', 'text'], ['email', 'email'], ['phone', 'phone'], ['status', 'enum']] },
  { name: 'Customers', icon: 'CircleUser', color: '#5ad1ff', fields: [['id', 'uuid'], ['name', 'text'], ['phone', 'phone'], ['email', 'email'], ['createdAt', 'timestamp']] },
  { name: 'Drivers', icon: 'Bike', color: '#c78bff', fields: [['id', 'uuid'], ['name', 'text'], ['phone', 'phone'], ['online', 'boolean'], ['rating', 'rating']] },
  { name: 'Vehicles', icon: 'Truck', color: '#ffb454', fields: [['id', 'uuid'], ['driver', 'reference'], ['type', 'enum'], ['plate', 'text']] },
  { name: 'Orders', icon: 'ClipboardList', color: '#a3f95b', fields: [['id', 'uuid'], ['customer', 'reference'], ['branch', 'reference'], ['driver', 'reference'], ['status', 'enum'], ['total', 'currency'], ['createdAt', 'timestamp']] },
  { name: 'OrderItems', icon: 'List', color: '#5ad1ff', fields: [['id', 'uuid'], ['order', 'reference'], ['product', 'reference'], ['qty', 'integer'], ['price', 'currency']] },
  { name: 'Payments', icon: 'CreditCard', color: '#c78bff', fields: [['id', 'uuid'], ['order', 'reference'], ['method', 'enum'], ['amount', 'currency'], ['status', 'enum']] },
  { name: 'Wallets', icon: 'Wallet', color: '#ffb454', fields: [['id', 'uuid'], ['customer', 'reference'], ['balance', 'currency'], ['currency', 'text']] },
  { name: 'Coupons', icon: 'Ticket', color: '#ff8f8f', fields: [['id', 'uuid'], ['code', 'text'], ['discount', 'decimal'], ['active', 'boolean'], ['expiresAt', 'date']] },
  { name: 'Offers', icon: 'Percent', color: '#7dd3fc', fields: [['id', 'uuid'], ['title', 'text'], ['branch', 'reference'], ['image', 'image'], ['active', 'boolean']] },
  { name: 'Addresses', icon: 'MapPin', color: '#a3f95b', fields: [['id', 'uuid'], ['customer', 'reference'], ['label', 'text'], ['city', 'enum'], ['location', 'geopoint']] },
  { name: 'DeliveryZones', icon: 'Map', color: '#5ad1ff', fields: [['id', 'uuid'], ['name', 'text'], ['city', 'enum'], ['fee', 'currency'], ['active', 'boolean']] },
  { name: 'Reviews', icon: 'MessageSquare', color: '#c78bff', fields: [['id', 'uuid'], ['customer', 'reference'], ['restaurant', 'reference'], ['comment', 'longtext'], ['createdAt', 'timestamp']] },
  { name: 'Ratings', icon: 'Star', color: '#ffb454', fields: [['id', 'uuid'], ['customer', 'reference'], ['order', 'reference'], ['stars', 'rating']] },
  { name: 'Notifications', icon: 'Bell', color: '#ff8f8f', fields: [['id', 'uuid'], ['customer', 'reference'], ['title', 'text'], ['body', 'longtext'], ['read', 'boolean']] },
  { name: 'SupportTickets', icon: 'LifeBuoy', color: '#7dd3fc', fields: [['id', 'uuid'], ['customer', 'reference'], ['subject', 'text'], ['status', 'enum'], ['createdAt', 'timestamp']] },
  { name: 'Favorites', icon: 'Heart', color: '#a3f95b', fields: [['id', 'uuid'], ['customer', 'reference'], ['restaurant', 'reference']] },
];

// Reference field → target entity name (for auto-wiring relations).
const REF_TARGET: Record<string, string> = {
  restaurant: 'Restaurants', branch: 'Branches', category: 'Categories', product: 'Products', driver: 'Drivers',
  customer: 'Customers', order: 'Orders', merchant: 'Merchants',
};

function toField([name, type]: FSpec): Field {
  const settings: Field['settings'] = { filterable: true, sortable: true };
  if (name === 'id') Object.assign(settings, { required: true, unique: true, indexed: true, readOnly: true });
  if (name === 'name' || name === 'title') Object.assign(settings, { required: true, searchable: true });
  if (type === 'enum') settings.options = ['pending', 'active', 'closed', 'cancelled'];
  return { id: did('f'), name, type, settings };
}

/** Build the full HAAT NOW schema (entities + relations) for one tenant. */
export function buildHaatModels(): { entities: Entity[]; relations: Relation[] } {
  const entities: Entity[] = SPECS.map((spec, i) => ({
    id: did('e'), name: spec.name, icon: spec.icon, color: spec.color, tags: ['haat'], system: true, version: 1,
    fields: spec.fields.map(toField),
    mapping: { provider: 'local', target: spec.name.toLowerCase(), reuses: '—' },
    permissions: (['create', 'read', 'update', 'delete'] as const).map(op => ({ id: did('p'), op, role: 'any' })),
    diagram: { x: 40 + (i % 5) * 220, y: 40 + Math.floor(i / 5) * 150 },
  }));
  const byName = new Map(entities.map(e => [e.name, e]));
  const relations: Relation[] = [];
  for (const e of entities) {
    for (const f of e.fields) {
      if (f.type !== 'reference') continue;
      const targetName = REF_TARGET[f.name];
      const target = targetName && byName.get(targetName);
      if (!target) continue;
      const type: RelationType = target.id === e.id ? 'self' : 'oneToMany';
      relations.push({ id: did('rel'), name: `${e.name}_${f.name}`, type, from: target.id, to: e.id, onDelete: 'cascade', orphanProtection: true });
    }
  }
  return { entities, relations };
}
