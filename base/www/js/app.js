angular.module('tabulator', ['ionic', 'ngCordova'])

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

.factory('Participants', function() {
  return {
    all: function() {
      var participant_string = window.localStorage['participants'];
      if(participant_string) {
        return angular.fromJson(participant_string);
      }
      return ["Me","You"];
    },
    save: function(participants) {
      window.localStorage['participants'] = angular.toJson(participants);
    }
  }
})

.controller('TabulatorCtrl', function($scope, $timeout, $ionicModal, $ionicPopup, $ionicSideMenuDelegate, $cordovaSocialSharing, Bills, Participants) {

    // A utility function for creating a new bill
    // with the given title
    var create_bill = function(bill_title) {
        var new_bill = Bills.add_new(bill_title);
        $scope.bills.push(new_bill);
        Bills.save($scope.bills);
        $scope.select_bill(new_bill, $scope.bills.length-1);
        $scope.open_add_item();
    }

    // Load participants
    $scope.participants = Participants.all();
    $scope.active_participants = [];

    // Settings data
    $scope.new_participant_name = "";

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

    // Create and load the Modal for settings
    $ionicModal.fromTemplateUrl('settings.html', function(modal) {
        $scope.settings_modal = modal;
    }, {
        scope: $scope,
        animation: 'slide-in-down'
    });

    // Create and load the Modal for archive
    $ionicModal.fromTemplateUrl('archive.html', function(modal) {
        $scope.archive_modal = modal;
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
                var participant = pp[j];
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
            for (var participant in $scope.bills[i].balances) {
                if (!new_total_balances[participant]) {
                    new_total_balances[participant] = {};
                }
                for (var currency in $scope.bills[i].balances[participant]) {
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

    $scope.open_settings = function() {
        $scope.settings_modal.show();
    };

    $scope.open_archive = function() {
        $scope.archive_modal.show();
    };

    $scope.close_standings = function() {
        $scope.standings_modal.hide();
    };

    $scope.close_settings = function() {
        $scope.settings_modal.hide();
    };

    $scope.close_archive = function() {
        $scope.archive_modal.hide();
    };

    $scope.share_archive = function() {
        var node = document.getElementById("archive_data");
        var content = node.innerText || node.textContent;
        $cordovaSocialSharing.share(content);
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

    $scope.add_participant = function(name) {
        if (name) {
            $scope.participants.push(name);
            $scope.participants.sort();
            Participants.save($scope.participants);
        }
    }

    $scope.get_colour = function(name) {
        var firstChar = name.charCodeAt(0);
        /* don't colour glyphs which are already colourful */
        if (    ((firstChar & 0x8000) == 0x8000) /* first char of a surrogate for an astral character (emoji are up here) */
             || ((firstChar & 0xff00) == 0x2600) /* star signs (which on android have a lovely* purple backdrop) *not lovely */
           ) {
            return -1;
        }
        var colour = 0;
        for (var i=0; i<name.length; i++) {
            colour += name.charCodeAt(i);
        }
        return colour%6;
    }

    $scope.reset_participants = function(new_participants) {
        if (new_participants.length > 1) {
            $ionicPopup.confirm({
                title: 'Replace all participants?',
            }).then(function(res) {
                if (res) {
                    $scope.participants = new_participants;
                    $scope.active_participants = [];
                    Participants.save($scope.participants);
                }
            });
        }
    }

    $scope.delete_participant = function(name) {
        if (name) {
            $ionicPopup.confirm({
                title: 'Remove '+name+'?',
            }).then(function(res) {
                if (res) {
                    if ($scope.active_participants.indexOf(name) > -1) {
                        $scope.active_participants.splice($scope.active_participants.indexOf(name),1);
                    }
                    if ($scope.participants.indexOf(name) > -1) {
                        $scope.participants.splice($scope.participants.indexOf(name),1);
                    }
                    if ($scope.participants == []) {
                        $scope.participants = ["Me","You"];
                    }
                    Participants.save($scope.participants);
                }
            });
        }
    }

    $scope.delete_all_data = function(name) {
            $ionicPopup.confirm({
                title: 'Delete all bills?',
            }).then(function(res) {
                if (res) {
                    window.localStorage['bills'] = '';
                    $scope.bills = [];
                    $scope.active_bill = null;
                    $scope.recalculate_total();
                }
            });
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
                inputPlaceholder: ''
            }).then(function(res) {
                if(res) {
                    create_bill(res);
                }
            });
        }
    });

});

