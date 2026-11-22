// Presentation context only. Backend RPCs/RLS always recheck actual authority.
// Never infer roles from profile/user_metadata or local storage.
const missingContract = error => ['PGRST202','42883'].includes(error?.code);
const invalidContext = () => Object.assign(new Error('Não foi possível verificar os acessos da conta.'), {code:'ACCOUNT_CONTEXT_INVALID'});
export async function loadAccountAccess(client, userId) {
 if(!userId) throw invalidContext();
 const result=await client.rpc('kg_account_context');
 if(result.error && !missingContract(result.error)) throw result.error;
 let context=result.data;
 let fallback=false;
 if(result.error){
  fallback=true;
  // A missing migration is the only fallback condition. Existing protected
  // endpoints, not cached user data, determine access during rollout.
  const admin=await client.rpc('kg_admin_context');
  if(admin.error && admin.error.code!=='42501') throw admin.error;
  if(!admin.error && (typeof admin.data?.mfa_required!=='boolean'||!Array.isArray(admin.data?.permissions))) throw invalidContext();
  context={user_id:userId,roles:['customer'],merchant_store_ids:[],
   admin_access:!admin.error && admin.data.mfa_required===false,
   admin_mfa_required:!admin.error && admin.data.mfa_required===true};
 }
 if(context?.user_id!==userId || !Array.isArray(context.roles) || !Array.isArray(context.merchant_store_ids)
  || typeof context.admin_access!=='boolean' || typeof context.admin_mfa_required!=='boolean'
  || (context.admin_access && context.admin_mfa_required)) throw invalidContext();
 const stores=await client.rpc('kg_my_managed_stores');
 if(stores.error) throw stores.error;
 if(!Array.isArray(stores.data)) throw invalidContext();
 // Legacy administrator listing includes every shop. Do not mislabel these as
 // assigned merchant shops: the new context is required to disambiguate them.
 const assigned=stores.data.filter(store=>(fallback ? store.status==='approved' : ['draft','pending','approved'].includes(store.status)) && (fallback
  ? !context.admin_access && !context.admin_mfa_required
  : context.merchant_store_ids.includes(store.id)));
 const adminEntry=context.admin_access||context.admin_mfa_required;
 return {stores:assigned,access:{userId,adminEntry,adminMfaRequired:context.admin_mfa_required,
  merchant:assigned.length>0,source:fallback?'protected-legacy-rpcs':'account-context'}};
}

export function canShowAdminEntry(account, online=true) {
 return Boolean(online && account?.phase==='ready' && account.user?.id
  && account.access?.userId===account.user.id && account.access.adminEntry===true);
}
