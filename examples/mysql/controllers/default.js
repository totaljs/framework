exports.install = function(framework) {
    framework.route('/', view_homepage);
};

function view_homepage() {

    var self = this;

    // definitions/mysql.js
    // create a DB connection
    self.database(function(err, connection){

        if(err != null) {
            self.view500(err);
            return;
        }

        // Table schema = { Id: Number, Age: Number, Name: String };
        connection.query('SELECT * FROM users', function(err, rows) {

            // Close connection
            connection.release();

            if (err != null) {
                self.view500(err);
                return;
            }

            // Shows the result on a console window
            console.log(rows);

            // Send rows as the model into the view
            self.view('homepage', rows);
        });

    });

}