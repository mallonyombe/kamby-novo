import {parsePriceMinor} from './merchant-domain.js';

const maputoTime=new Intl.DateTimeFormat('sv-SE',{
 timeZone:'Africa/Maputo',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});

function localTime(instant){
 return maputoTime.format(instant).replace(' ','T');
}

export function promotionInstant(date,time,end=false){
 if(!date&&!time)return null;
 if(!date)throw new Error('Escolhe uma data para esta hora.');
 const local=date+'T'+(time||'00:00');
 // Maputo civil time is UTC+02:00.
 const instant=new Date(local+'+02:00');
 if(!Number.isFinite(instant.getTime())||localTime(instant)!==local){
  throw new Error('Indica uma data e hora válidas.');
 }
 if(end&&!time)instant.setUTCDate(instant.getUTCDate()+1);
 return instant.toISOString();
}

function scheduleFields(value,end=false){
 if(!value)return ['',''];
 const instant=new Date(value);
 const [date,time]=localTime(instant).split('T');
 if(time!=='00:00')return [date,time];
 if(!end)return [date,''];
 instant.setUTCDate(instant.getUTCDate()-1);
 return [localTime(instant).split('T')[0],''];
}

export function sellerPriceFields(item){
 const normal=item.previous_price_minor??item.price_minor;
 const [promotionStartDate,promotionStartTime]=scheduleFields(item.promotion_starts_at);
 const [promotionEndDate,promotionEndTime]=scheduleFields(item.promotion_ends_at,true);
 return {
  price:normal?(Number(normal)/100).toFixed(2):'',
  promotionEnabled:item.previous_price_minor!=null,
  promoPrice:item.previous_price_minor!=null?(Number(item.price_minor)/100).toFixed(2):'',
  promotionStartDate,promotionStartTime,promotionEndDate,promotionEndTime
 };
}

export function visibleSellerPrice(item,commonPrice,at){
 const regular=parsePriceMinor(item.price.trim()||commonPrice.trim()||'0');
 if(!item.promotionEnabled)return {price:regular};
 const start=promotionInstant(item.promotionStartDate,item.promotionStartTime);
 const end=promotionInstant(item.promotionEndDate,item.promotionEndTime,true);
 if((start&&at<Date.parse(start))||(end&&at>=Date.parse(end)))return {price:regular};
 return {price:parsePriceMinor(item.promoPrice),previous:regular};
}
