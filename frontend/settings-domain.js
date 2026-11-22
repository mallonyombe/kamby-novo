export function profileValues(name,location){
 const displayName=String(name||'').trim().replace(/\s+/g,' '),place=String(location||'').trim();
 if([...displayName].length<2||[...displayName].length>80)throw new Error('O nome deve ter entre 2 e 80 caracteres.');
 if([...place].length>120)throw new Error('A localização pode ter até 120 caracteres.');
 return {display_name:displayName,location:place};
}
export function passwordError(password,confirmation){
 if(String(password).length<8)return 'A palavra-passe precisa de pelo menos 8 caracteres.';
 if(String(password).length>128)return 'Usa até 128 caracteres.';
 return password===confirmation?'':'As palavras-passe não coincidem.';
}
export function readTheme(storage){try{const value=storage.getItem('kamby:theme');return ['auto','light','dark'].includes(value)?value:'auto';}catch{return 'auto';}}
