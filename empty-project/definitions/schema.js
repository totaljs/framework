

// Contact form
builders.schema('contanctform', { name: 'string(50)', email: 'string(120)', message: 'string(5000)', ip: 'string(60)', created: Date });
builders.validation('contanctform', ['name', 'email', 'message']);