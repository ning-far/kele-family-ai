# PostgreSQL migrations

001_identity.sql establishes identity, family, profiles and explicit profile grants. It is not a complete production migration yet.

Run as a dedicated migration owner in an empty test database first. Runtime roles must have NOSUPERUSER/NOBYPASSRLS and must not own tables. No runtime grants are issued by this script.

Pending: policies for membership/grant administration, guarded profile creation/deletion, last-admin protection, practice/reward transactions, migration ledger and rollback rehearsal. Test missing actor, revoked membership, cross-family references and private conversation isolation with a real PostgreSQL runtime role before deployment.

No database connection or cloud resources have been provisioned by this migration file.

Run `node apps/server/scripts/migrations.mjs` from the workspace root for a checksum preview. Applying requires `MIGRATION_DATABASE_URL` and `--apply`; use a migration owner against an approved test database. A database advisory lock serializes runs, and the ledger write commits in the same transaction as each migration. Changed applied files fail instead of silently rerunning. Keep this credential separate from `DATABASE_URL`.

015 adds pending learning invitations with forced RLS. Local restricted-role verification passed creation replay/conflict/expiry/foreign denial with no implicit grants. Runtime needs SELECT, INSERT on kele.learning_invitations only; UPDATE/DELETE stay denied. No cloud migration performed. Acceptance, revocation and concurrency validation remain pending.

016 adds revoked_at; reviewed runtime grant is UPDATE(revoked_at), never table-wide UPDATE. Read/insert policies remain; creator revocation must retain non-null marker. Verified with restricted local role. Acceptance remains pending.

017 adds recipient-only invitation SELECT policy and cursor indexes; existing runtime SELECT remains sufficient. Local restricted-role inbox isolation and 53-row pagination verified, without profile access. No cloud migration performed.

018 adds lock visibility for active owner admins with use/read grants; WITH CHECK(false) adds no profile mutation permission. Local PG reproduction and fix verified, including attempted UPDATE denial. Not applied to cloud.

019 stores profile label snapshot for invitation identification. Legacy rows retain generic label; creation derives it from locked server profile, not client input. Restricted local PG verified, no cloud migration.

## 授权来源 v0.6（2026-10-02）

020新增invitation_access_sources独立表和邀请accepted_at。来源表通过复合外键绑定邀请ID/家庭/档案/接收者，只允许profile.use或progress.read，按邀请和权限去重，邀请删除级联清理。它不与独立profile_grants混存，撤销时无需删除已有独立授权。来源记录仅供接收者本人读取，强制RLS，无运行时写入策略。accepted_at不授予运行账号UPDATE权限。

为什么此阶段不接有效权限：现有档案列表、权限查询、进度导出和设置都有直接读取profile_grants的路径，单独改has_profile_permission会造成各入口不一致。后续须统一有效权限读取，验证多来源/独立授权并存、撤销即时失效、创建者资格失效和软删除，再启用接受接口。受控接受入口仍未实现，不将来源表存在当成功接受。

验收：020只应用127.0.0.1:55432独立测试PG。真实受限角色验证两项权限约束、复合目标外键、本人读取/创建者不可读、即使授予INSERT仍被RLS拒绝、来源记录不产生档案可见性；完整既有PG回归退出0，finally清理临时账号、数据、角色。没有云迁移或新页面验收。

## 统一有效权限入口 v0.7（2026-10-02）

021新增effective_profile_permissions并由has_profile_permission调用；仍为SECURITY INVOKER，身份来自可信事务set_config，保留原RLS。当前仅返回活动成员、未删除档案的独立profile_grants；邀请来源明确尚未纳入有效权限。

档案列表和权限快照改走统一函数，设置只读也走统一判断；设置写、学习写、邀请创建、家庭创建重试继续锁原有独立授权行，不因只读邀请获得写/管理能力。进度、导出及数据策略已通过has_profile_permission复用同一入口。运行角色需显式GRANT EXECUTE ON FUNCTION kele.effective_profile_permissions(uuid,uuid)，PUBLIC不可执行；本机fixture/验证角色同步添加授权。未来纳入邀请来源还需档案RLS可见性和实时创建者资格，未完成前不开接受接口。

验证：021只应用独立本机PG，受限角色整轮隔离/删除/学习/配置/导出/邀请测试退出0并清理。全仓类型检查通过；首轮65项有1项旧查询参数断言失败（actor仍通过set_config绑定，列表SQL不再重复账号参数），更新断言检查统一函数且SQL不拼账号后完整重跑。最终结果以本轮进展为准；没有新增浏览器或云验收。

## 邀请有效读取 v0.8（2026-10-02）

022新增固定只读资格谓词invitation_access_is_effective：绑定可信事务接收账号，要求已接受、未撤销、双方活动家庭关系、创建者仍管理员且本人拥有未删除档案，并保留独立使用/学习读授权。接受后邀请到期不自动取消授权，撤销则失效。

谓词需要跨用户查资格，使用SECURITY DEFINER、固定pg_catalog search_path及全限定表名、无动态SQL，只返回布尔值，PUBLIC不可执行。迁移要求函数拥有者具BYPASSRLS或超级用户，否则直接拒绝安装；运行账号不可成为此拥有者。当前只在隔离本机迁移拥有者下验收，云端需另评审拥有者权限及可用性，不能把本机角色配置直接当云配置完成。

023将有效邀请来源并入统一权限入口，并增加档案只读RLS；只返回来源记录本身的两项权限，不开放写入。fixture增加来源SELECT及资格函数EXECUTE。受控接受事务仍未实现，因此无用户可用的接受接口/按钮。

真实受限PG验证：测试拥有者准备已接受记录（不是接受接口），接收者可见档案，权限恰为使用/学习读，可导出进度及读取通用设置，设置写和学习提交拒绝；外账号/无actor/接收关系撤销/创建者读权删除资格无效；邀请撤销后档案隐藏且导出拒绝；独立两项授权保留时访问仍可用。全部恢复或清理测试记录，整轮退出0。接受事务原子性/竞争、UI及云端尚未验证。

## 受控接受事务 v0.9（2026-10-02）

024新增accept_learning_invitation(uuid)，固定返回邀请/档案/重试标记，SECURITY DEFINER固定pg_catalog路径、全限定表名、PUBLIC禁用，要求拥有者绕过RLS且运行角色无拥有者身份。仓储createInvitationAcceptor仅接受可信actor和邀请UUID，在事务内绑定规范化身份并调用函数，失败回滚/释放。尚未接HTTP或界面。

事务锁邀请行，与撤销互斥；锁创建者档案/关系/两项独立读授权，按家庭+接收账号锁序列化缺席关系创建；新成员固定member/active，已活动角色不改，被撤销拒绝。提交前以clock_timestamp而非事务起始now检查期限，避免锁等待越过到期仍接受。两项来源和accepted_at同事务提交。重复接受不恢复来源；已接受但关系缺失拒绝，不重建成员（纯状态函数同步修正）。

真实本机PG受限角色首次接受/大小写重复/恰两来源/跨账号拒绝/撤销拒绝/过期拒绝/被撤销成员不恢复通过；两个独立连接同邀请仅一个首创，同时接受撤销最终无有效访问、后续接受拒绝。并发实际调度为不确定顺序，本轮不冒称已强制覆盖两种锁先后；缺席成员跨不同邀请竞争、故障注入/死锁重试、UI仍需补验。固定锁定可能与其他删除流程锁顺序形成死锁，数据库回滚保证不半提交，自动重试尚未实现，不宣称完全无死锁。

024仅独立本机PG迁移，测试数据/账号/角色finally清理。云角色权限尚未确认；没有正式发布或外部账号写入。
