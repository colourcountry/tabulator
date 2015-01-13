tabulator
=========

Web and Android app for settling bills among groups.

Tabulator manages 'bills' which consist of a list of 'items'. For example, different items of food on a restaurant bill.
People can share an item (for example, if they split a dessert)

When it comes to paying, payments are also considered as items. Just like for the 'food' items, you can put several people paying the 
same amount into the same item.

So, an item
- has a value and a currency
- is either a credit (an amount contributed) or a debit (an amount consumed)
- can be assigned to one or more participants in the group (sharing the cost)

When a bill is complete, the amount contributed (credit items) must equal the amount spent (debit items).
This means the bill is 'balanced'. It doesn't mean nobody owes anyone anything, it just means nobody owes the restaurant anything.

You can run up multiple bills within the app. At any time you can see how much each person owes, and how much each person is owed,
in each currency that is in use.

You can also export the raw data in CSV via email or dropbox evernote or whatever your phone has.

Tabulator doesn't work out how best to settle the bill, because this is actually a Hard Problem in maths.
A pretty good strategy is for all the owing parties to pay the one who is owed most, then for that one to pay the remaining creditors.

Limitation
----------

Right now, the list of people in the group is hard coded. 


How to use it
-------------

When you start up the app, if there is no data, the 'New bill' popup will appear. Otherwise, click the + icon to create a new bill.

Click + again to create an item.

Enter the value and the currency in the box. Tabulous doesn't actually know anything about currencies. It just takes any non-numeric stuff 
you put before or after the value. It does currently assume that your currency has 100 smaller units in the larger unit. Sorry Kuwait.

Check 'Credit' if the item represents a contribution.

Now check the boxes for the people who contributed (if credit) or who spent (if debit) the money.

Tips
----
Don't bother with a currency symbol for your favourite (or home) currency.

If you want certain types of things to be split out and shown separately in the final table,
add a 'tag' to the items when you enter them.
E.g. $5.00 beer
Tabulator behaves as if you had a new currency '$beer'


Build
-----

This is an Ionic framework app. To build it yourself

1. Install Ionic including the command line utility ionic
2. ionic start Tabulator
3. Install the Social Sharing plugin from https://github.com/EddyVerbruggen/SocialSharing-PhoneGap-Plugin
3. Overwrite files in the project with files from this repo
4. Fix .gitignore up

I may invent a more elegant way sometime.

