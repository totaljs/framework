ECHO "[COMPILING]"
cd ..
ECHO "....... backup.js"
uglifyjs backup.js -o minify/partial.js/backup.js
ECHO "....... builders.js"
uglifyjs builders.js -o minify/partial.js/builders.js
ECHO "....... image.js"
uglifyjs image.js -o minify/partial.js/image.js
ECHO "....... index.js"
uglifyjs index.js -o minify/partial.js/index.js
ECHO "....... internal.js"
uglifyjs internal.js -o minify/partial.js/internal.js
ECHO "....... mail.js"
uglifyjs mail.js -o minify/partial.js/mail.js
ECHO "....... markdown.js"
uglifyjs markdown.js -o minify/partial.js/markdown.js
ECHO "....... nosql.js"
uglifyjs nosql.js -o minify/partial.js/nosql.js
ECHO "....... utils.js"
uglifyjs utils.js -o minify/partial.js/utils.js

cp readme.md minify/partial.js/readme.md
cp package.json minify/partial.js/package.json
cp license.txt minify/partial.js/license.txt

mkdir minify/partial.js/bin/
cp bin/partial minify/partial.js/bin

cd minify
node minify.js