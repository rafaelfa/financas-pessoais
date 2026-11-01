// Prova da T1: compara a árvore de trabalho com HEAD ficheiro a ficheiro, ao nível
// da AST TypeScript (parser real, sem posições). Reordenação de classes Tailwind,
// trailing commas, aspas, parênteses e espaços em JSX deixam de contar como
// diferença; qualquer alteração de lógica, literal, import ou uso de componente
// aparece como DIFERE.
//
// Uso, na raiz do projeto:  node relatorios/T1-comparar-ast.js
// Saída esperada na T1: "Ficheiros com diferença de AST: 0 de 12".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const repo = process.cwd();
const ts = require(path.join(repo, 'node_modules', 'typescript'));

const files = execSync('git diff --name-only', { cwd: repo, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((f) => !['pnpm-lock.yaml', '.prettierignore'].includes(f));

function classesOf(text) {
  return text.split(/\s+/).filter(Boolean).sort().join(' ');
}

function dump(src, name) {
  const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  function walk(node) {
    if (ts.isParenthesizedExpression(node)) {
      ts.forEachChild(node, walk);
      return;
    }
    if (ts.isJsxText(node)) {
      const t = node.text.replace(/\s+/g, ' ').trim();
      if (t) out.push('JsxText:' + t);
      return;
    }
    let label = ts.SyntaxKind[node.kind];
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) label += ':' + node.text;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      label += ':' + node.text;
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'className' && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        out.push('className{' + classesOf(node.initializer.text) + '}');
        return;
      }
      out.push('classNameExpr');
    }
    out.push(label);
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return out;
}

let bad = 0;
for (const f of files) {
  const headSrc = execSync(`git show HEAD:${JSON.stringify(f)}`, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const wtSrc = fs.readFileSync(path.join(repo, f), 'utf8');
  const a = dump(headSrc, f);
  const b = dump(wtSrc, f);
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push(`${i}: HEAD=${a[i]} | WT=${b[i]}`);
  }
  console.log(
    `${diffs.length === 0 ? 'IGUAL   ' : 'DIFERE  '} ${f}  (nós ${a.length} -> ${b.length})`,
  );
  if (diffs.length) {
    bad++;
    console.log('   ' + diffs.slice(0, 10).join('\n   '));
  }
}
console.log(`\nFicheiros com diferença de AST: ${bad} de ${files.length}`);
void os;
