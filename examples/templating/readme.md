Template condition:

- object value must be a Boolean or Number

BOOLEAN EXAMPLE:

{ boolean | 'if true (encoded)' : 'if false (encoded) - optional' }
{ !boolean | 'if true (raw)' : 'if false (raw) - optional' }

NUMBER EXAMPLE:

number == 0 = even
number == 1 = odd
number == 2 = even
number == 3 = odd

{ number | 'if even (encoded)' : 'if odd (encoded) - optional' }
{ number | 'if even (raw)' : 'if odd (raw) - optional' }

INTERNAL ARRAY INDEX EXAMPLE:

{ # | 'even' }