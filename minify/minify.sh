ECHO "[COMPILING]"
cd ..
mkdir minify/total.js/bin/
ECHO "....... builders.js"
uglifyjs builders.js -o minify/total.js/builders.js
ECHO "....... image.js"
uglifyjs image.js -o minify/total.js/image.js
ECHO "....... index.js"
uglifyjs index.js -o minify/total.js/index.js
ECHO "....... internal.js"
uglifyjs internal.js -o minify/total.js/internal.js
ECHO "....... mail.js"
uglifyjs mail.js -o minify/total.js/mail.js
ECHO "....... nosql.js"
uglifyjs nosql.js -o minify/total.js/nosql.js
ECHO "....... utils.js"
uglifyjs utils.js -o minify/total.js/utils.js
ECHO "....... binary"
uglifyjs bin/total -o minify/total.js/bin/total
ECHO "....... binary"

cp readme.md minify/total.js/readme.md
cp package.json minify/total.js/package.json
cp license.txt minify/total.js/license.txt

cd minify
node minify.js