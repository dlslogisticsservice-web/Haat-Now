# 02 — Admin Module Matrix (inspection-only)

Reachability via `AdminSidebar.tsx` (grouped sidebar) → `AdminDashboard.tsx` render switch.
`super` = visible only to `scope==='super'` admins.

## Admin modules (src/features/admin/)
| Module | File | Sidebar key | Reachable | Localized | Completion |
|---|---|---|---|---|---|
| Executive Dashboard | AdminDashboardHome.tsx | `kpi` | ✅ | ✅ | ~95% |
| Coupons | AdminDashboard.tsx (tab) | `coupons` | ✅ | ✅ | ~90% |
| Settings/Config | AdminDashboard.tsx (tab) | `config` | ✅ | ✅ | ~85% |
| Support/Helpdesk | AdminDashboard.tsx (tab) | `support` | ✅ | ✅ | ~90% |
| Operations Center (shell) | OperationsCenter.tsx | `ops:*` | ✅ | ✅ | ~90% |
| — Command Center (live map) | OperationsCommandCenter.tsx | `ops:command` | ✅ | ✅ | ~85% (needs Maps key) |
| — Dispatch | OperationsCenter (panel) | `ops:dispatch` | ✅ | ✅ | ~90% |
| — Zones | OperationsCenter (panel) | `ops:zones` | ✅ | ✅ | ~90% |
| — Drivers/Performance | OperationsCenter (panel) | `ops:performance` | ✅ | ✅ | ~90% (AdminDataTable) |
| — Vehicles | OperationsCenter (panel) | `ops:vehicles` | ✅ | ✅ | ~85% |
| — Payouts | OperationsCenter (panel) | `ops:payouts` | ✅ | ✅ | ~90% |
| Finance Center | FinanceCenter.tsx | `ops:finance` | ✅ | ✅ | ~90% |
| Customer Care | CustomerCareCenter.tsx | `ops:care` | ✅ | ✅ | ~90% |
| Growth (B) | GrowthCenterB.tsx | `ops:growthb` | ✅ | ✅ | ~90% |
| Growth (legacy) | GrowthCenter.tsx | via Operations `growth` tab | ✅ | ✅ | ~85% |
| KYC / Compliance | KycCenter.tsx | `ops:kyc` | ✅ | ✅ | ~90% |
| System Logs | SystemLogs.tsx | `logs` (super) | ✅ | ✅ | ~80% (needs audit_logs grant) |
| Notifications | NotificationCenter.tsx | `notifications` | ✅ | ✅ | ~90% |
| Global Search | GlobalSearch.tsx | Ctrl+K trigger | ✅ | ✅ | ~90% |
| Campaign Center | CampaignCenter.tsx | `campaigns` (super) | ✅ | ⚠️ partial AR | ~80% |
| Design Center | DesignCenter.tsx | `design` (super) | ✅ | ⚠️ AR-hardcoded | ~85% |
| — Experience Builder | ExperienceBuilder.tsx | via DesignCenter section | ✅ | ⚠️ AR-hardcoded | ~80% |
| — Assets Manager | AssetsManager.tsx | via DesignCenter section | ✅ | ⚠️ AR-hardcoded | ~75% |
| — Country Branding | CountryBranding.tsx | via DesignCenter section | ✅ | ⚠️ AR-hardcoded | ~80% |

## Feature-matrix (purpose / backend / frontend / nav / production-ready)
| Module | Backend | Frontend | In nav | Prod-ready |
|---|---|---|---|---|
| Operations/Dispatch | `ops/*.service` + RPCs + Realtime | ✅ | ✅ | ⚠️ needs Maps key |
| Finance/Settlements | `finance.service` + RPCs | ✅ | ✅ | ⚠️ real data |
| Growth/Coupons/Loyalty | `growthb.service`,`growth.service` | ✅ | ✅ | ✅ |
| KYC/Compliance | `onboarding.service` | ✅ | ✅ | ⚠️ needs storage/docs |
| System Logs | `audit_logs` table | ✅ | ✅ | ❌ grant not applied to sandbox |
| Design/Theme/Experience | `screen_experiences` + localStorage | ✅ | ✅ (super) | ⚠️ AR-only UI |
| Notifications | `notifications` + Realtime | ✅ | ✅ | ✅ |

## Duplicates / legacy noted (NOT removed — inspection only)
- `GrowthCenter.tsx` (legacy: cashback/affiliates/influencers) **and** `GrowthCenterB.tsx`
  (coupons/loyalty/promotions/banners) — two growth modules, both reachable (B via sidebar,
  legacy via Operations `growth` tab). Candidate for consolidation.
- `src/components/ui/EnterpriseSidebar.tsx` (used by MerchantApp) vs `src/features/admin/
  AdminSidebar.tsx` (admin) — two sidebar implementations for different apps (not a true duplicate).
