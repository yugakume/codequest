/* Bounded educational interpreter: intentionally supports a documented subset of C. */
(function(root){
'use strict';
class CError extends Error{constructor(msg,line){super(msg);this.line=line||1;}}
function compile(source){
 const ts=[];let i=0,line=1;
 while(i<source.length){let s=source.slice(i),m;
  if((m=/^\s+/.exec(s))){line+=(m[0].match(/\n/g)||[]).length;i+=m[0].length;continue;}
  if(s.startsWith('//')){while(i<source.length&&source[i]!='\n')i++;continue;}
  if(s.startsWith('/*')){let end=source.indexOf('*/',i+2);if(end<0)throw new CError('コメントを閉じる */ が必要です。',line);let x=source.slice(i,end+2);line+=(x.match(/\n/g)||[]).length;i=end+2;continue;}
  if(s[0]=='#'){let end=source.indexOf('\n',i);if(end<0)end=source.length;let d=source.slice(i,end);if(!/^#\s*include\s*<stdio\.h>\s*$/.test(d))throw new CError('使えるヘッダーは #include <stdio.h> です。',line);i=end;continue;}
  if((m=/^"(?:[^"\\\n]|\\[ntr"\\])*"/.exec(s))){ts.push({v:m[0],kind:'str',line});i+=m[0].length;continue;}
  if((m=/^(?:\d+|[A-Za-z_]\w*|==|!=|<=|>=|\+\+|--|\+=|-=|&&|\|\||[{}()[\];,+\-*/%<>=!&])/.exec(s))){ts.push({v:m[0],line});i+=m[0].length;continue;}
  throw new CError('この文字は使えません: '+s[0],line);
 }
 ts.push({v:'<end>',line});let p=0;const cur=()=>ts[p],is=v=>cur().v===v,pop=()=>ts[p++];
 const want=v=>{if(!is(v))throw new CError('「'+v+'」が必要です。今あるのは「'+cur().v+'」です。',cur().line);return pop();};
 const id=()=>{let t=pop();if(!/^[A-Za-z_]\w*$/.test(t.v)||['int','if','else','while','for','return','void'].includes(t.v))throw new CError('変数の名前が必要です。',t.line);return t;};
 function primary(){let t=pop(),n;if(t.kind==='str'){n={k:'lit',v:JSON.parse(t.v),line:t.line};}else if(/^\d+$/.test(t.v)){n={k:'lit',v:Number(t.v),line:t.line};}else if(t.v==='('){n=expr();want(')');}else if(/^[A-Za-z_]\w*$/.test(t.v)){n={k:'id',v:t.v,line:t.line};}else throw new CError('ここには数値や変数を入れてください。',t.line);
  while(true){if(is('[')){pop();let x=expr();want(']');n={k:'index',a:n,b:x,line:t.line};}else if(is('(')){pop();let args=[];if(!is(')')){do{args.push(expr());if(!is(','))break;pop();}while(true);}want(')');n={k:'call',fn:n,args,line:t.line};}else if(is('++')||is('--')){n={k:'post',op:pop().v,a:n,line:t.line};}else break;}return n;
 }
 function unary(){if(['!','-','+','&','*','++','--'].includes(cur().v)){let t=pop();return{k:'unary',op:t.v,a:unary(),line:t.line};}return primary();}
 const prec={'=':1,'+=':1,'-=':1,'||':2,'&&':3,'==':4,'!=':4,'<':5,'>':5,'<=':5,'>=':5,'+':6,'-':6,'*':7,'/':7,'%':7};
 function expr(min=1){let a=unary();while(prec[cur().v]>=min){let t=pop(),pr=prec[t.v],b=expr(pr+(pr===1?0:1));a={k:'bin',op:t.v,a,b,line:t.line};}return a;}
 function declaration(semi=true){let t=want('int'),pointer=false;if(is('*')){pop();pointer=true;}let name=id().v,size=null,init=null;
  if(is('[')){pop();if(!is(']'))size=expr();else size='auto';want(']');}
  if(is('=')){pop();if(is('{')){pop();init=[];if(!is('}'))while(true){init.push(expr());if(!is(','))break;pop();if(is('}'))break;}want('}');}else init=expr();}
  if(semi)want(';');return{k:'decl',name,pointer,size,init,line:t.line};
 }
 function statement(){let t=cur();if(is('{')){pop();let body=[];while(!is('}')){if(is('<end>'))want('}');body.push(statement());}pop();return{k:'block',body,line:t.line};}
  if(is('int'))return declaration();
  if(is('if')){pop();want('(');let test=expr();want(')');let yes=statement(),no=null;if(is('else')){pop();no=statement();}return{k:'if',test,yes,no,line:t.line};}
  if(is('while')){pop();want('(');let test=expr();want(')');return{k:'while',test,body:statement(),line:t.line};}
  if(is('for')){pop();want('(');let init=is(';')?null:is('int')?declaration(false):expr();want(';');let test=is(';')?null:expr();want(';');let inc=is(')')?null:expr();want(')');return{k:'for',init,test,inc,body:statement(),line:t.line};}
  if(is('return')){pop();let value=is(';')?null:expr();want(';');return{k:'return',value,line:t.line};}
  if(is(';')){pop();return{k:'empty',line:t.line};}
  let value=expr();want(';');return{k:'expr',value,line:t.line};
 }
 want('int');want('main');want('(');if(is('void'))pop();want(')');let tree=statement();want('<end>');return tree;
}
function run(source){let tree=compile(source),scopes=[new Map()],memory=[],output='',steps=0;const LIMIT=12000;let returned=false;
 const fail=(s,n)=>{throw new CError(s,n.line);};const tick=n=>{if(++steps>LIMIT)fail('実行が長すぎます。ループの終了条件や、カウンターの更新を確認してみよう。',n);};
 const lookup=(name,n)=>{for(let i=scopes.length-1;i>=0;i--)if(scopes[i].has(name))return scopes[i].get(name);fail('「'+name+'」が見つかりません。int で宣言したか、綴りを確認しよう。',n);};
 const num=(v,n)=>{if(typeof v!=='number'||!Number.isFinite(v))fail('ここでは整数が必要です。ポインタの値を読むときは * を使おう。',n);return v;};
 const ref=n=>{if(n.k==='id')return lookup(n.v,n);if(n.k==='index'){let a=evaluate(n.a),i=num(evaluate(n.b),n);if(!Array.isArray(a))fail('配列にだけ [ ] を使えます。',n);if(i<0||i>=a.length||!Number.isInteger(i))fail('配列の範囲外です。添字は 0 から '+(a.length-1)+' までです。',n);return a[i];}if(n.k==='unary'&&n.op==='*'){let r=evaluate(n.a);if(!r||!r.cell)fail('このポインタは有効な変数を指していません。&変数名 でつなごう。',n);return r;}fail('代入先には変数、配列の要素、*ポインタ を使います。',n);};
 function evaluate(n){tick(n);if(n.k==='lit')return n.v;if(n.k==='id'||n.k==='index')return ref(n).v;
  if(n.k==='post'){let r=ref(n.a),v=num(r.v,n);r.v+=n.op==='++'?1:-1;return v;}
  if(n.k==='unary'){if(n.op==='&')return ref(n.a);if(n.op==='*')return ref(n).v;if(n.op==='++'||n.op==='--'){let r=ref(n.a);r.v=num(r.v,n)+(n.op==='++'?1:-1);return r.v;}let a=num(evaluate(n.a),n);return n.op==='!'?+!a:n.op==='-'?-a:a;}
  if(n.k==='bin'){if(['=','+=','-='].includes(n.op)){let r=ref(n.a),v=evaluate(n.b);if(Array.isArray(r.v))fail('配列全体には代入できません。要素を指定しよう。',n);r.v=n.op==='='?v:n.op==='+='?num(r.v,n)+num(v,n):num(r.v,n)-num(v,n);return r.v;}
   let a=num(evaluate(n.a),n);if(n.op==='&&')return a?+!!num(evaluate(n.b),n):0;if(n.op==='||')return a?1:+!!num(evaluate(n.b),n);let b=num(evaluate(n.b),n);
   if((n.op==='/'||n.op==='%')&&b===0)fail('0 では割れません。割る数を確認しよう。',n);
   switch(n.op){case '+':return a+b;case '-':return a-b;case '*':return a*b;case '/':return Math.trunc(a/b);case '%':return a%b;case '<':return +(a<b);case '>':return +(a>b);case '<=':return +(a<=b);case '>=':return +(a>=b);case '==':return +(a===b);case '!=':return +(a!==b);}}
  if(n.k==='call'){if(n.fn.k!=='id'||n.fn.v!=='printf')fail('このラボで使える関数は printf です。',n);let args=n.args.map(evaluate),idx=1,fmt=args[0];if(typeof fmt!=='string')fail('printf の最初には "文字列" を入れよう。',n);let s=fmt.replace(/%([dsc%])/g,(_,f)=>{if(f==='%')return '%';if(idx>=args.length)fail('% に対応する値が足りません。',n);let v=args[idx++];return f==='d'?String(Math.trunc(num(v,n))):f==='c'?String.fromCharCode(num(v,n)):String(v);});if(/%(?!%)[A-Za-z]/.test(fmt.replace(/%[dsc%]/g,'')))fail('書式は %d、%s、%c、%% に対応しています。',n);output+=s;if(output.length>2000)fail('出力が多すぎます。ループの回数を減らしてみよう。',n);return s.length;}
  fail('この式にはまだ対応していません。',n);
 }
 function execute(n){if(!n||returned)return;tick(n);switch(n.k){case 'block':scopes.push(new Map());try{for(let s of n.body){execute(s);if(returned)break;}}finally{scopes.pop();}break;
  case 'decl':{let scope=scopes[scopes.length-1];if(scope.has(n.name))fail('「'+n.name+'」はこの場所ですでに宣言されています。',n);let v=0;if(n.size!==null){let vals=Array.isArray(n.init)?n.init.map(evaluate):[];let len=n.size==='auto'?vals.length:num(evaluate(n.size),n);if(len<1||len>128||!Number.isInteger(len))fail('配列の長さは 1〜128 にしてください。',n);if(vals.length>len)fail('配列の要素が長さを超えています。',n);v=Array.from({length:len},(_,i)=>({cell:true,v:vals[i]||0,label:n.name+'['+i+']'}));}else if(n.init)v=evaluate(n.init);let cell={cell:true,v,label:n.name,pointer:n.pointer,address:'0x'+(4096+memory.length*4).toString(16)};scope.set(n.name,cell);memory.push(cell);break;}
  case 'expr':evaluate(n.value);break;case 'return':if(n.value)evaluate(n.value);returned=true;break;case 'if':execute(num(evaluate(n.test),n)?n.yes:n.no);break;
  case 'while':while(!returned&&num(evaluate(n.test),n))execute(n.body);break;
  case 'for':scopes.push(new Map());try{if(n.init){if(n.init.k==='decl')execute(n.init);else evaluate(n.init);}while(!returned&&(!n.test||num(evaluate(n.test),n))){tick(n);execute(n.body);if(!returned&&n.inc)evaluate(n.inc);}}finally{scopes.pop();}break;
 }}
 execute(tree);return{output,memory:memory.slice(-24).map(c=>({name:c.label,address:c.address,pointer:c.pointer,value:Array.isArray(c.v)?c.v.map(x=>x.v):c.v&&c.v.cell?'→ '+c.v.label:c.v,target:c.v&&c.v.cell?c.v.label:null})),steps};
}
root.CEngine={run,compile,CError};
})(typeof window!=='undefined'?window:globalThis);
