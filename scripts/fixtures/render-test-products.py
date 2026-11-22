"""Generate original code-drawn test illustrations, not photographs or real brands."""
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from pathlib import Path
import sys
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font=lambda size:ImageFont.truetype(font_path,size)
for kind in ['caneca','jarro','tenis','auriculares','arroz','oleo','acucar','cafe']:
 for order in (0,1):
  im=Image.new('RGB',(720,720),'#f6f4ef');d=ImageDraw.Draw(im)
  shadow=Image.new('RGBA',im.size);sd=ImageDraw.Draw(shadow);sd.ellipse((160,548,560,600),fill=(63,48,35,36));shadow=shadow.filter(ImageFilter.GaussianBlur(17));im=Image.alpha_composite(im.convert('RGBA'),shadow)
  obj=Image.new('RGBA',im.size);p=ImageDraw.Draw(obj)
  if kind=='caneca':
   p.ellipse((426,300,590,481),fill='#b06143');p.ellipse((453,327,557,453),fill='#f6f4ef');p.rounded_rectangle((183,270,463,548),radius=48,fill='#bc6c4d');p.ellipse((183,242,463,320),fill='#d38b6b');p.ellipse((207,256,440,306),fill='#694837');p.line((210,324,210,485),fill='#ce8264',width=7)
  elif kind=='jarro':
   p.polygon([(280,210),(440,210),(420,300),(477,405),(450,560),(270,560),(243,405),(300,300)],fill='#d2bea0');p.ellipse((280,191,440,231),fill='#a48e73');p.ellipse((298,198,422,219),fill='#665646');p.line((294,330,274,452,292,530),fill='#e2d0b5',width=10)
  elif kind=='tenis':
   p.polygon([(126,430),(191,421),(241,288),(317,275),(396,372),(487,404),(585,453),(604,514),(543,544),(186,537),(120,503)],fill='#f3f5f2');p.polygon([(191,421),(241,288),(317,275),(396,372),(489,406),(443,484),(172,489)],fill='#6a8b98');p.polygon([(130,490),(445,493),(585,464),(604,514),(543,544),(186,537),(120,510)],fill='#d8ddd9');p.polygon([(327,380),(383,413),(447,418),(403,451),(350,430)],fill='#d5ece3');
   for n in range(4):p.line((260+n*23,338+n*20,303+n*23,319+n*21),fill='#f8faf7',width=9)
  elif kind=='auriculares':
   p.rounded_rectangle((184,354,536,552),radius=65,fill='#dfe5e5');p.line((193,400,526,400),fill='#b4c0c4',width=3);p.ellipse((345,468,359,482),fill='#6c8b8d');
   for x in (245,437):
    p.rounded_rectangle((x-17,198,x+23,336),radius=18,fill='#dce5e8');p.ellipse((x-47,161,x+31,233),fill='#f5f8fa');p.ellipse((x-30,181,x-5,214),fill='#83989d')
  elif kind in ['arroz','acucar','cafe']:
   colors={'arroz':('#e8ddbd','#56755c','ARROZ','GRÃO LONGO'), 'acucar':('#dce9ef','#3b7389','AÇÚCAR','BRANCO'), 'cafe':('#98724d','#3d4333','CAFÉ','TORRADO')}
   base,band,label,sub=colors[kind];p.polygon([(235,197),(485,197),(515,557),(205,557)],fill=base);p.rectangle((238,180,482,208),fill=band);p.rectangle((214,346,505,473),fill=band);p.text((360,373),label,font=font(35),fill='#fff',anchor='mm');p.text((360,426),sub,font=font(15),fill='#fff',anchor='mm');p.text((360,511),'1 kg' if kind!='cafe' else '250 g',font=font(25),fill=band,anchor='mm');
   for n in range(6):
    x=275+n*27;y=272+(n%2)*14;p.ellipse((x,y,x+15,y+26),fill=band)
  else:
   p.rounded_rectangle((255,275,465,566),radius=44,fill='#e6be4a');p.polygon([(285,281),(292,224),(428,224),(435,281)],fill='#edce76');p.rounded_rectangle((290,177,430,240),radius=13,fill='#54705c');p.rectangle((266,378,454,491),fill='#fcf5d7');p.text((360,410),'ÓLEO',font=font(32),fill='#54684a',anchor='mm');p.text((360,451),'GIRASSOL',font=font(17),fill='#54684a',anchor='mm');p.line((278,302,278,357),fill='#f5db81',width=11)
  if order:obj=obj.rotate(-7,resample=Image.Resampling.BICUBIC,center=(360,420))
  im=Image.alpha_composite(im,obj);d=ImageDraw.Draw(im);d.text((360,58),'KAMBY · IMAGEM ILUSTRATIVA',font=font(16),fill='#756e64',anchor='mm');d.text((360,654),'LOJA FICTÍCIA · TESTE',font=font(15),fill='#756e64',anchor='mm')
  im.convert('RGB').save(out/f'{kind}-{order}.png',optimize=True)
print('16 original test illustrations rendered')
