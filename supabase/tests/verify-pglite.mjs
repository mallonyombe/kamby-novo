import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const db=new PGlite();
try {
 await db.exec(read('./mock-platform.sql'));
 const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort();
 if(!migrations.length)throw new Error('No migration files found');
 const sellerOnboarding=migrations.find(name=>name.endsWith('_seller_onboarding.sql'));
 for(const migration of migrations.filter(name=>name<sellerOnboarding)){
  await db.exec(read(`../migrations/${migration}`));
  console.log(`PASS: migration compiles on PostgreSQL/PGlite (${migration})`);
  if(migration==='20261111070949_initial_greenfield.sql'){
   await db.exec(read('./initial-rls.sql'));
   console.log('PASS: initial migration historical contract unchanged');
  }
 }
 await db.exec(read('./rls.sql'));
 await db.exec(read('./merchant-rls.sql'));
 await db.exec(read('./product-creation.sql'));
 await db.exec(read('./settings-rls.sql'));
 await db.exec(read('./catalogue-editor.sql'));
 await db.exec(read('./platform-operations.sql'));
 await db.exec(read('./account-security.sql'));
 await db.exec(read('./legacy-invariants.sql'));
 console.log('PASS: legacy/direct activation requires responsible, final responsible protected, membership invalidates CAS, MFA and self-assignment blocked');
 await db.exec(read('./preparation-contact.sql'));
 console.log('PASS: private preparation, no self-registration, schedules/overnight, closed contacts and preserved carts');
 console.log('PASS: unified account context, forged roles, IDOR, revocation, MFA, management-only stores and guest browsing');
 console.log('PASS: MFA across legacy and admin APIs, operation permissions, atomic audit, idempotency, stale writes, lifecycle and last responsible protection');
 console.log('PASS: complete catalogue editor, drafts, exact retries, rollback, variant retirement, promotion validation, concurrency and store settings');
 console.log('PASS: account isolation, saved products, contact idempotency, request permissions, notifications and preferences');
 console.log('PASS: atomic product publication, upload paths, variants, cleanup, exact retries and isolated merchant access');
 console.log('PASS: assigned merchants, exact prices, variants, stale writes, private metrics, revocation and isolation');
 console.log('PASS: managed stores, variants, ordered media, variant carts, WhatsApp snapshots, audit and private storage');
 // The previous suites include legacy administrative creation and assignment
 // as fixture setup. Exercise those contracts before the deliberate cutover.
 await db.exec(read('../migrations/'+sellerOnboarding));
 await db.exec(read('./seller-onboarding.sql'));
 console.log('PASS: historical seller activation and review migration');
 for(const migration of migrations.filter(name=>name>sellerOnboarding))await db.exec(read('../migrations/'+migration));
 await db.exec(read('./seller-self-publication.sql'));
 await db.exec(read('./catalogue-discovery.sql'));
 console.log('PASS: anonymous discovery, pagination past 60, scoped search and available variant prices');
 await db.exec(read('./archived-product-delete.sql'));
 await db.exec(read('./category-variant-axes.sql'));
 await db.exec(read('./preconfigured-category-catalogue.sql'));
 console.log('PASS: category presets, accent-insensitive search, active/inactive roles and store assignment');
 console.log('PASS: category creation requires MFA, variants have a valid axis, deletion preserves products');
 console.log('PASS: unpublished product deletion, access, stale writes and retry');
 console.log('PASS: versioned consent, private drafts and seller self-publication');
 await db.exec(read('./account-terms.sql'));
 console.log('PASS: account terms are public to read, versioned and accepted per authenticated account');
 await db.exec(read('./admin-detail.sql'));
 console.log('PASS: administrator detail requires MFA, valid pagination and existing identity');
 await db.exec(read('./admin-profile-privacy.sql'));
 console.log('PASS: delegated user detail keeps operational data and withholds contacts, sign-in timestamp and profile photo');
 await db.exec(read('./scheduled-promotions.sql'));
 console.log('PASS: scheduled promotion boundaries, editor retries, public prices, cart and checkout');
 await db.exec(read('./registration-privacy.sql'));
 console.log('PASS: signup age and versions, immutable proof, export isolation, marketing choices and report validation');
 const tables=await db.query("select count(*)::int as rows from public.kg_stores");
 if(tables.rows[0].rows!==0) throw new Error('Test fixture rollback failed');
 const bucket=await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='kg-product-images'");
 if(bucket.rows[0].public!==false || Number(bucket.rows[0].file_size_limit)!==5242880 || bucket.rows[0].allowed_mime_types.includes('image/svg+xml')) throw new Error('Unsafe bucket config');
 console.log('PASS: fixtures rolled back; private bucket limited to 5 MiB JPEG/PNG/WebP');
} catch(error) {
 console.error('FAIL:',JSON.stringify({message:error.message,code:error.code,where:error.where}));
 process.exitCode=1;
} finally { await db.close(); }
