angular.module('tabulator', ['ionic'])

/**
 * The Bills factory handles saving and loading bills
 * from local storage, and also lets us save and load the
 * last active bill index.
 */
.factory('Bills', function() {
  return {
    all: function() {
      var bill_string = window.localStorage['bills'];
      if(bill_string) {
        return angular.fromJson(bill_string);
      }
      return [];
    },
    save: function(bills) {
      window.localStorage['bills'] = angular.toJson(bills);
    },
    add_new: function(bill_title) {
      // Add a new bill
      return {
        title: bill_title,
        value: 0,
        balance: 0,
        balances: {},
        is_balanced: null,
        items: []
      };
    },
    get_last_active_index: function() {
      return parseInt(window.localStorage['bills/last_active_index']) || 0;
    },
    set_last_active_index: function(index) {
      window.localStorage['bills/last_active_index'] = index;
    }
  }
})

.controller('TabulatorCtrl', function($scope, $timeout, $ionicModal, $ionicPopup, $ionicSideMenuDelegate, Bills) {

    // A utility function for creating a new bill
    // with the given title
    var create_bill = function(bill_title) {
        var new_bill = Bills.add_new(bill_title);
        $scope.bills.push(new_bill);
        Bills.save($scope.bills);
        $scope.select_bill(new_bill, $scope.bills.length-1);
        $scope.open_add_item();
    }

    // Load participants (FIXME: hard coded for now)
    $scope.participants = {"CM":1,"DL":2,"DT":3,"MT":4,"RW":5,"SA":6};
    $scope.active_participants = [];

    // Hold on to form data
    $scope.item_is_credit = false;
    $scope.item_is_each = false;
    $scope.item_title = "";
    $scope.item_value = null;

    // Load or initialize bills
    $scope.bills = Bills.all();

    // Grab the last active, or the first bill
    $scope.active_bill = $scope.bills[Bills.get_last_active_index()];

    // Called to create a new bill
    $scope.open_add_bill = function() {
        $ionicPopup.prompt({
            title: 'Create a bill',
            okText: 'Create',
            inputType: 'text'
        }).then(function(res) {
            if(res) {
                create_bill(res);
            }
        });
    };

    // Only one editable property for a bill, so use a prompt
    $scope.open_edit_bill = function() {
        $ionicPopup.prompt({
            title: "Rename '"+$scope.active_bill.title+"'",
            okText: 'Rename',
            inputType: 'text'
        }).then(function(res) {
            if(res) {
                $scope.active_bill.title = res;
                $scope.recalculate_active_bill();
            }
        });
    };    

    // Delete before confirming
    $scope.open_delete_bill = function() {
        if( $scope.active_bill ){
            $ionicPopup.confirm({
                title: "Delete '"+$scope.active_bill.title+"' and all items?",
                okText: "Delete"
            }).then(function(res) {
                if(res) {
                    var index = Bills.get_last_active_index();
                    $scope.bills.splice(index,1);
                    if ($scope.bills.length == 0) {
                        $scope.active_bill = null;
                        Bills.set_last_active_index(null);
                    } else if (index == 0) {
                        $scope.active_bill = 0;
                        Bills.set_last_active_index(0);
                    } else {
                        $scope.active_bill = index-1;
                        Bills.set_last_active_index(index-1);
                    }
                    console.log("side menu is "+$ionicSideMenuDelegate.isOpenLeft()+" open");
                    $scope.open_bills();
                    $scope.recalculate_total();
                }
            });
        }
    };    

    // Called to select the given bill
    $scope.select_bill = function(bill, index) {
        $scope.active_bill = bill;
        Bills.set_last_active_index(index);
        $scope.close_bills();
    };

    // Create and load the Modal for new items
    $ionicModal.fromTemplateUrl('new-item.html', function(modal) {
        $scope.item_modal = modal;
    }, {
        scope: $scope,
        animation: 'slide-in-up'
    });

    // Create and load the Modal for standings
    $ionicModal.fromTemplateUrl('standings.html', function(modal) {
        $scope.standings_modal = modal;
    }, {
        scope: $scope,
        animation: 'slide-in-up'
    });

    // Called when the form is submitted
    $scope.create_item = function(item) {

        if(!$scope.active_bill || !item) {
            console.log("Didn't create an item.");
            return;
        }
        if($scope.active_participants.length==0) {
            console.log("No participants selected");
            return;
        }

        var match = /([^0-9.-]*)([.]?[0-9][0-9,.]*)([^0-9.-]*)/.exec(item.value);
        if(!match) {
            console.log("Illegal value "+item.value);
            return;
        }

        // remove thousands separators and replace , decimal with .
        var value = match[2].replace(/[,.](?!.?.?$)/g,'').replace(/,/,'.');
        console.log("Normalized value as "+value);

        var multiplier = 1;
        if(item.is_each) {
            multiplier = $scope.active_participants.length;
        }

        // If both before and after are specified, use before only
        var currency_before = match[1].trim();
        var currency_after = currency_before ? "" : match[3].trim();

        var new_item = {
            title: item.title,
            currency_before: currency_before,
            value: value,
            currency_after: currency_after,
            is_credit: item.is_credit,
            participants: $scope.active_participants.slice(0),
            multiplier: multiplier
        };
        $scope.active_bill.items.push(new_item);
        console.log("Added item "+JSON.stringify(new_item));
        $scope.item_modal.hide();
        $scope.recalculate_active_bill();

        item.title = "";
        item.value = "";
        item.is_each = false;
        item.is_credit = false;
    }

    $scope.recalculate_active_bill = function() {
        var total_value = {};
        var total_balance = {};
        var balances = {};
        var is_balanced = true;
        for (var i=0; i<$scope.active_bill.items.length; i++) {

            var value = Math.floor( $scope.active_bill.items[i].value * $scope.active_bill.items[i].multiplier * 100 );
            var currency_before = $scope.active_bill.items[i].currency_before;
            var currency_after = $scope.active_bill.items[i].currency_after;
            var pp = $scope.active_bill.items[i].participants.slice(0);

            // work out share/shaft before changing sign, so that % and floor go towards zero
            var share = Math.floor( value / pp.length );
            var shaft = value % pp.length;

            if( $scope.active_bill.items[i].is_credit ) {
                value = -value;
            }

            // Add text to start of key so it doesn't begin with a "$"
            var currency = "safe" + currency_before + currency_after;

            if( !total_balance[currency] ){
                total_balance[currency] = { currency_before: currency_before,
                                            value: 0,
                                            currency_after: currency_after };
            }
            total_balance[currency].value += value;

            if( !total_value[currency] ){
                total_value[currency] = { currency_before: currency_before,
                                          value: 0,
                                          currency_after: currency_after };
            }

            if (value>=0) {
                total_value[currency].value += value;
            } else {
                share = -share;
            }

            console.log(value+" ("+currency+") split between "+pp.length+" = "+share+" each plus "+shaft);
            for (var j=0; j<pp.length; j++) {
                participant = pp[j];
                if (!balances[participant]) {
                    balances[participant] = {};
                }
                if (!balances[participant][currency]) {
                    balances[participant][currency] = { currency_before: currency_before,
                                                        value: share,
                                                        currency_after: currency_after };
                } else {
                    balances[participant][currency].value += share;
                }
            }

            while (pp.length > shaft) {
                var lucky = Math.floor(Math.random() * pp.length);
                pp.splice(lucky,1);
            }
            for (var j=0; j<pp.length; j++) {
                participant = pp[j];
                if (value>0) {
                    balances[participant][currency].value += 1;
                    console.log("Added 1 to debit balance of "+participant);
                } else {
                    balances[participant][currency].value -= 1;
                    console.log("Added 1 to credit balance of "+participant);
                }
            }
        }
        console.log("New calculated value: "+JSON.stringify(total_value));
        console.log("New calculated balance: "+JSON.stringify(total_balance));
        console.log("New calculated participant balances: "+JSON.stringify(balances));
        $scope.active_bill.value = total_value;
        $scope.active_bill.balance = total_balance;
        $scope.active_bill.balances = balances;
        console.log(total_balance);
        for (currency in total_balance) {
            if( total_balance[currency].value != 0 ){
                is_balanced = false;
            }
        }
        $scope.active_bill.is_balanced = is_balanced;
        $scope.recalculate_total();
    }

    $scope.recalculate_total = function() {

        var new_total_per_currency = {};
        var new_total_balances = {};

        for (var i=0; i<$scope.bills.length; i++) {
            for (participant in $scope.bills[i].balances) {
                if (!new_total_balances[participant]) {
                    new_total_balances[participant] = {};
                }
                for (currency in $scope.bills[i].balances[participant]) {
                    var value = $scope.bills[i].balances[participant][currency];
                    if (!new_total_per_currency[currency]) {
                        new_total_per_currency[currency] = {
                            currency_before: value.currency_before,
                            value: 0,
                            currency_after: value.currency_after };
                    }

                    if (!new_total_balances[participant]) {
                        new_total_balances[participant] = {};
                    }
                    if (!new_total_balances[participant][currency]) {
                        new_total_balances[participant][currency] = {
                            currency_before: value.currency_before,
                            value: 0,
                            currency_after: value.currency_after };
                    }

                    new_total_per_currency[currency].value += $scope.bills[i].balances[participant][currency].value;
                    new_total_balances[participant][currency].value += $scope.bills[i].balances[participant][currency].value;
                }
            }
        }

        $scope.total_balances = new_total_balances;
        $scope.total_per_currency = new_total_per_currency;
        Bills.save($scope.bills);

    };

    $scope.open_add_item = function() {
        if( $scope.active_bill ){
            $scope.item_modal.show();
        }
    };

    $scope.open_edit_item = function(item, index) {

            var title = null;
            if (item.title) {
                title = "Delete item '"+item.title+"'?";
            } else if (item.is_credit) {
                title = "Delete this item of "+item.currency_before+" "+item.value+" "+item.currency_after+" credit?";
            } else {
                title = "Delete this item of "+item.currency_before+" "+item.value+" "+item.currency_after+"?";
            }

            $ionicPopup.confirm({
                title: title,
                okText: "Delete"
            }).then(function(res) {
                if(res) {
                    $scope.active_bill.items.splice(index,1);
                    $scope.recalculate_active_bill();
                }
            });
        /* TODO: allow editing of line items, not just deletion */

    };

    $scope.close_add_item = function() {
        $scope.item_modal.hide();
    };

    $scope.open_standings = function() {
        $scope.standings_modal.show();
    };

    $scope.close_standings = function() {
        $scope.standings_modal.hide();
    };

    $scope.toggle_bills = function() {
        $ionicSideMenuDelegate.toggleLeft();
    };

    $scope.open_bills = function() {
        if (!$ionicSideMenuDelegate.isOpenLeft()) {
            $scope.toggle_bills();
        }
    }

    $scope.close_bills = function() {
        if ($ionicSideMenuDelegate.isOpenLeft()) {
            $scope.toggle_bills();
        }
    }

    $scope.toggle_participant_selected = function(name, selected) {
        var index = $scope.active_participants.indexOf(name);
        if (selected && index > -1) {
            return;
        }
        if (selected) {
            $scope.active_participants.push(name);
        } else {
            $scope.active_participants.splice(index, 1);
        }
        $scope.active_participants.sort();
    };

    $scope.is_participant_selected = function(name) {
        return $scope.active_participants.indexOf(name) > -1;
    }

    // Try to create the first bill, make sure to defer
    // this by using $timeout so everything is initialized
    // properly
    $timeout(function() {
        $scope.recalculate_total();
        if($scope.bills.length == 0) {
            $scope.open_bills();
            $ionicPopup.prompt({
                title: 'Create a bill',
                subTitle: 'Enter a name for the first bill',
                okText: 'Create',
                inputType: 'text',
                inputPlaceholder: 'Food'
            }).then(function(res) {
                if(res) {
                    create_bill(res);
                }
            });
        }
    });

});

