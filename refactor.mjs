import { Project, SyntaxKind } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths([
  'packages/pinmark/src/vanilla/**/*.ts',
  'packages/extension/src/popup/**/*.ts'
]);

for (const sourceFile of project.getSourceFiles()) {
  let changed = false;
  
  const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  
  // Collect replacements to apply them safely
  const replacements = [];

  for (const pa of propAccesses) {
    if (pa.getName() === 'innerHTML') {
      const parent = pa.getParent();
      if (parent.getKind() === SyntaxKind.BinaryExpression) {
        const binExpr = parent;
        if (binExpr.getOperatorToken().getKind() === SyntaxKind.EqualsToken && binExpr.getLeft() === pa) {
          const something = pa.getExpression().getText();
          const expr = binExpr.getRight().getText();
          replacements.push({
            node: binExpr,
            text: `setHTML(${something}, ${expr})`
          });
        }
      }
    }
  }

  if (replacements.length > 0) {
    // Sort replacements from bottom to top to avoid messing up offsets
    replacements.sort((a, b) => b.node.getPos() - a.node.getPos());
    for (const rep of replacements) {
      rep.node.replaceWithText(rep.text);
    }
    changed = true;
  }

  if (changed) {
    const path = sourceFile.getFilePath();
    if (path.includes('popup.ts')) {
      sourceFile.addImportDeclaration({
        namedImports: ['setHTML'],
        moduleSpecifier: '../../../pinmark/src/vanilla/domUtils'
      });
    } else {
      sourceFile.addImportDeclaration({
        namedImports: ['setHTML'],
        moduleSpecifier: './domUtils.js'
      });
    }
    sourceFile.saveSync();
    console.log(`Updated ${path}`);
  }
}
