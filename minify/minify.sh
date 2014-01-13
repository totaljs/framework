ECHO "[COMPILING]"
cd ..
mkdir minify/partial.js/bin/
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
ECHO "....... nosql.js"
uglifyjs nosql.js -o minify/partial.js/nosql.js
ECHO "....... utils.js"
uglifyjs utils.js -o minify/partial.js/utils.js
ECHO "....... binary"
uglifyjs bin/partial -o minify/partial.js/bin/partial

cp readme.md minify/partial.js/readme.md
cp package.json minify/partial.js/package.json
cp license.txt minify/partial.js/license.txt

cd minify
node minify.js