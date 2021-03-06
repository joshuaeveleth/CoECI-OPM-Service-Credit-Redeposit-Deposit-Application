/*
 Copyright 2014 OPM.gov
 
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 
 http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var currentNote = null;
var currentDeleteMode = null;
var gAccountInfo = null;
$(function() {
    // Setup page
    setupPage('VIEW_ACCOUNT', 0);

    var context = $('#context').val();
    var accountId = $('#accountId').val();
    populateNamedEntity('payTypes', context);
    populateNamedEntity('serviceTypes', context);
    populateNamedEntity('retirementTypes', context);
    populateNamedEntity('appointmentTypes', context);
    populateNamedEntity('periodTypes', context);
    populateNamedEntity('countries', context);
    populateNamedEntity('states', context);
    populateNamedEntity('suffixes', context);
    populateNamedEntity('accountStatuses', context);
    $('#billingSummaryTab').hide();
    var account = getAccount(context, accountId);
    gAccountInfo = account;
    refreshEmployeeInfo(account);
    refreshAccountSummary(account);
    refreshPaymentTable(accountId);
    populateBillingSummary(account.billingSummary);
    populateCalculationVersion(account);

    $(".paymentHistoryPanel .jsAddPayment").click(function() {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        $('.addPaymentPopup input[name="batchNum"]').val('');
        $('.addPaymentPopup input[name="blockNum"]').val('');
        $('.addPaymentPopup input[name="seqNum"]').val('');
        $('.addPaymentPopup input[name="paymentAmount"]').val('');
        $('.addPaymentPopup input[name="depositDate"]').val('');
        $('.addPaymentPopup input[name="addPaymentAppliance"][value=1]').prop('checked', true);
        
        $('.addPaymentPopup div.currentAccountInfo div.fLeft div.accountField p.fieldVal').eq(0).text(account.claimant);
        $('.addPaymentPopup div.currentAccountInfo div.fLeft div.accountField p.fieldVal').eq(1).text(account.claimNumber);
		$('.addPaymentPopup div.currentAccountInfo div.fRight div.accountField p.fieldVal').eq(0).text(formatNotificationDate(account.holder.birthDate));
		$('.addPaymentPopup div.currentAccountInfo div.fRight div.accountField p.fieldVal').eq(1).text("$" + (account.balance!=null?account.balance.toFixed(2):"0.00"));
		
        showPopup(".addPaymentPopup ");
    });
    
    $(document).on("change", ".glcheckbox", function() {
        // add to the modification changed payments
        var paymentId = $(this).closest("tr").data('payment-id');
        var payment = null;
        for (var i = 0; i < currentPayments.length; i++) {
            if (currentPayments[i].id == paymentId) {
                payment = currentPayments[i];
            }
        }
        if (payment != null) {
            payment.applyToGL = $(this).prop('checked');
            modifiedPayments.push(payment);
        }
    });

    $('.jsSavePHChanges').on("click", function() {
    	if ($(this).hasClass('priBtnDisabled')) {
    		return;
    	}
        $.ajax({
            url: context + '/payment',
            type: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(modifiedPayments),
            success: function() {
                // clear the modifiedPayments
                modifiedPayments = [];
                // refresh the list
                $('.jsRefreshPaymentList').click();
            },
            error: function(response) {
                alert("Failed to save the changes: " + response.responseText);
            }
        });
    });

    $('.jsRefreshPaymentList').click(function() {
        $('.jsRefreshAccountDetails').click();
    });

    $(".jsPrintStatement, .jsReprintStatement").click(function(e) {
        var context = $('#context').val();
        var accountId = $('#accountId').val();
        var account = getAccount(context, accountId);
        var holder = account.holder;
        var version = getOfficialVersion(account.calculationVersions);
        var statementDiv = $('.printStatementPopup .popupBody');
        var paymentAmount = findLatestPayment(account.paymentHistory);
        var priorBalance = account.balance == null ? 0 : account.balance;
        // CSD
        $('.printNum span, .claimNum span', statementDiv).html(account.claimNumber);
        // birthday
        $('.printBirth span', statementDiv).html(parseDateToString(holder.birthDate));
        // address
        $('.printAddressBody', statementDiv).html(buildAddrerssString(holder.address));
        // payment amount
        $('.printAcount', statementDiv).html(paymentAmount);
        // name
        $('.name-report span', statementDiv).html(holder.firstName + ' ' + (holder.middleInitial == null ? '' : holder.middleInitial) + ' ' + holder.lastName);
        // cover by
        $('.coveredBy span', statementDiv).html(account.planType);
        // date
        $('.date span', statementDiv).html(parseDateToString(version.calculationDate));
        // prior balance
        $('.priorBalance span', statementDiv).html(priorBalance);
        // interest
        $('.interest span', statementDiv).html(version.calculationResult.summary.totalInitialInterest);
        // balance due before payment
        $('.balanceBeforePayment span', statementDiv).html(priorBalance + version.calculationResult.summary.totalInitialInterest);
        // payment amount
        $('.payment span', statementDiv).html(paymentAmount);
        // billing information
        var spans = $('.detailsLine', statementDiv).find('span');
        $.each(account.billingSummary.billings, function() {
            spans.eq(mapping[this.name]).html(this.balance);
        });
        // new balance due
        $('.detailsLine').next('p').find('span').html(priorBalance + version.calculationResult.summary.totalBalance - paymentAmount);
        // format currency
        $('.dollar').formatCurrency({negativeFormat: '%s-%n'});
        showPopup(".printStatementPopup");
    });

    $('#paymentHistoryTbl tbody').on("click", "tr", function() {
        // remove the previous selected rows
        $(this).closest("tbody").find("tr.selectedRow").each(function() {
            $(this).removeClass("selectedRow");
        });
        // mark this row selected
        $(this).removeClass("hovered");
        $(this).addClass("selectedRow");
    });
    $('.jsReversePayment').click(function() {
        var selectedRow = $("#paymentHistoryTbl tbody tr.selectedRow");
        if (selectedRow.length == 0) {
            alert("You must select a row first.");
            return;
        }
        var paymentId = selectedRow.data('payment-id');
        if ($('#paymentReversalReasons').val() == null || $('#paymentReversalReasons').val() == "") {
            alert("You should choose a reverse reason.");
            return;
        }
        var reason = $('#paymentReversalReasons').val();
        var applyReverseToGL = $("#applyReversalTo").prop('checked');
        var url = context + '/payment/reverse';
        $.ajax({
            url: url,
            cache: false,
            async: true,
            type: "POST",
            data: {
                paymentId: paymentId,
                applyReversalToGL: applyReverseToGL,
                paymentReversalReasonId: reason
            },
            success: function() {
                // success
                refreshPaymentTable(accountId);
            },
            error: function() {
                alert("Failed to reverse payment.")
            }

        });
        closePopup();
    });

    // check homeTab
    if (user.defaultTab == 'VIEW_ACCOUNT') {
        $('#setHome').prop('checked', true);
    }
    $('#setHome').click(function() {
        if ($(this).prop('checked') == true) {
            makeHomeTab(context, 'VIEW_ACCOUNT', accountId);
        } else {
            makeHomeTab(context);
        }
    });
    // button trigger begin
    $('.notesToFirst').click(function() {
        if ($(this).hasClass('priBtnDisabled')) {
            return false;
        }
        currentNote = $('.note-tbody').children('tr').eq(0);
        populateNote();
        adjustNavButton();
    });

    $('.notesToPrev').click(function() {
        if ($(this).hasClass('priBtnDisabled')) {
            return false;
        }
        currentNote = $(currentNote).prev('tr');
        populateNote();
        adjustNavButton();
    });

    $('.notesToNext').click(function() {
        if ($(this).hasClass('priBtnDisabled')) {
            return false;
        }
        currentNote = $(currentNote).next('tr');
        populateNote();
        adjustNavButton();
    });

    $('.notesToLast').click(function() {
        if ($(this).hasClass('priBtnDisabled')) {
            return false;
        }
        currentNote = $('.note-tbody').children('tr').eq($('.note-tbody').children('tr').length - 1);
        populateNote();
        adjustNavButton();
    });

    $(".jsEditNotePopup").click(function() {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        closePopup();
        populateNote();
        showPopup(".accountNotesEditPopup");
        $('.accountNotesEditPopup a.jsClipboardCopy').zclip({
            path: context + '/js/ZeroClipboard.swf',
            copy: function() {
                // Bug Fix 2
                //showPopup(".accountNoteCopyPopup");
                return $('#noteEdit').val();
            }
        });
    });


    $(".jsEditNote").click(function() {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        var checked = $("#accountNoteTbl tbody input:checked");
        if (checked.length < 1) {
            closePopup();
            showPopup(".noAccountNoteSelectedEditPopup ");
        } else {
            closePopup();
            currentNote = checked.eq(0).parent('td').parent('tr');
            populateNote();
            // Bug Fix 2
            adjustNavButton();
            showPopup(".accountNotesEditPopup");
        }
    });
    $(".jsDelNote").click(function() {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        var checked = $("#accountNoteTbl tbody input:checked");
        currentDeleteMode = 1;
        if (checked.length < 1) {
            closePopup();
            currentDeleteMode = 1;
            showPopup(".noAccountNoteSelectedPopup");
        } else {
            if (checked.length == 1) {
                $('.delAccountNotePopup').find('p').html('Do you want to delete this note?');
            } else {
                $('.delAccountNotePopup').find('p').html('Do you want to delete these notes?');
            }


            closePopup();
            showPopup(".delAccountNotePopup ");
        }
    });


    $(".jsDelNotePopup").click(function() {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        currentDeleteMode = 2;
        $('.delAccountNotePopup').find('p').html('Do you want to delete this note?');
        closePopup();
        showPopup(".delAccountNotePopup ");
    });

    $(".jsEditBasicInfo").click(function(e) {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        $(".accountBasicInfoPanel").hide();
        populateEditInfo(context, accountId);
        $(".accountBasicInfoPanelEdit").show();
        $(".employeeTab .rowCheckStatus").removeClass("rowCheckShow");
        $(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox").hide();
        $(".employeeTab .accountBasicInfoPanelEdit .tabBtnsWrapper .priBtn").hide();
        $(".employeeTab .accountBasicInfoPanelEdit .tabBtnsWrapper .editEmployeeBtn").show();
    });


    //Edit Employee Basic tab
    $(".jsCancelEditBasicInfo").click(function(e) {
        $(".employeeTab .rowCheckStatus").removeClass("rowCheckShow");
        $(".accountBasicInfoPanel").show();
        $(".accountBasicInfoPanelEdit").hide();
    });
    $(".jsConfirmNewAccountValidity").click(function(e) {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        populateEditInfo(context, accountId);
        $('.jsRejectConfirmNewAccountValidity, .jsApproveConfirmNewAccountValidity').removeClass('priBtnDisabled');
        if (checkApproveRejectStatus() == true) {
            $('.jsRejectConfirmNewAccountValidity').addClass('priBtnDisabled');
        } else {
            $('.jsApproveConfirmNewAccountValidity').addClass('priBtnDisabled');
        }

        $(".employeeTab .rowCheckStatus").removeClass("rowCheckShow");
        $(".accountBasicInfoPanel").hide();
        $(".accountBasicInfoPanelEdit").show();
        $(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox").show();
        $(".employeeTab .accountBasicInfoPanelEdit .tabBtnsWrapper .priBtn").hide();
        $(".employeeTab .accountBasicInfoPanelEdit .tabBtnsWrapper .validEmployeeBtn").show();

    });

    $('.checkValidateInputBox').click(function() {
        $('.jsRejectConfirmNewAccountValidity, .jsApproveConfirmNewAccountValidity').removeClass('priBtnDisabled');
        if (checkApproveRejectStatus() == true) {
            $('.jsRejectConfirmNewAccountValidity').addClass('priBtnDisabled');
        } else {
            $('.jsApproveConfirmNewAccountValidity').addClass('priBtnDisabled');
        }
    });

    $('.validationErrorOk').click(function() {
        if ($('.basicValidationError').html().indexOf('reason') != -1) {
            showPopup(".rejectAccountPopup");
            $('.jsConfirmNewAccountValidity').trigger('click');
        }
    });

    $(".jsCancelConfirmNewAccountValidity").click(function(e) {
        $(".employeeTab .rowCheckStatus").removeClass("rowCheckShow");
        refreshEmployeeInfo(getAccount(context, accountId));
        $(".accountBasicInfoPanel").show();
        $(".accountBasicInfoPanelEdit").hide();
    });
    $(".jsRejectConfirmNewAccountValidity").click(function(e) {
        if (checkApproveRejectStatus() == false) {
            if (validateBasicInfo() == false) {
                return false;
            }
            showPopup(".rejectAccountPopup");
        }

    });

    $(".jsDoRejectAccount").click(function() {
        if (reject(context, accountId) == true) {
            refreshEmployeeInfo(getAccount(context, accountId));
            $(".employeeTab .rowCheckStatus").addClass("rowCheckShow");
            $(".accountBasicInfoPanel").show();
            $(".accountBasicInfoPanelEdit").hide();
            closePopup();
        }
    });


    $(".jsApproveConfirmNewAccountValidity").click(function(e) {
        if (checkApproveRejectStatus() == true) {
            if (validateBasicInfo() == false) {
                return false;
            }
            approve(context, accountId);
            refreshEmployeeInfo(getAccount(context, accountId));
            $(".accountBasicInfoPanel").show();
            $(".accountBasicInfoPanelEdit").hide();
        }

    });

    function doAccountRefresh() {
        var account = getAccount(context, accountId);
        refreshAccountSummary(account);
        refreshEmployeeInfo(account);
        populateBillingSummary(account.billingSummary);
        $('.jsRefreshGrid').trigger('click');
        refreshNotes(context, accountId);
        $('#loadingOverlay2').hide();
        refreshPaymentTable(accountId);
    }
    $('.jsRefreshAccountDetails').click(function() {
        $('#loadingOverlay2').show();
        setTimeout(doAccountRefresh, 1000);
    });

    $('#paymentHistoryTbl').on("refreshPaymentTable", function() {
        refreshPaymentTable(accountId);
    });

    $(".jsShowLastUpdateBtn").click(function(e) {
        closePopup();
        $.ajax({
            url: context + '/account/' + accountId + '/updateInterest',
            type: 'POST',
            success: function(data, text, xhr) {
                var account = getAccount(context, accountId);
                populateBillingSummary(account.billingSummary);
                $('.jsPHReceipt').trigger('click');
            },
            error: function(a, b, c) {
                if (a.responseText == 'The current account has already been calculated as of today.') {
                    $(".jsLastUpdate").trigger('click');
                } else {
                    alert(a.responseText);
                }
            }
        });
        //$(".jsLastUpdate").show();
        //$(".jsUpdateInterest").hide();
        //showPopup(".updateInterestReportPopup");
    });

    $(".jsSaveEditBasicInfo").click(function() {
        if (saveEmployeeInfo(context, accountId, true) == false) {
            return false;
        }
        //showPopup(".confirmSaveEmployeePopup");
    });

    //Edit Billing Info
    $(".jsEditBillingInfo").click(function(e) {
    	if ($(this).hasClass("priBtnDisabled")) {
    		return;
    	}
        $(".billingSummaryPanel").hide();
        $(".billingSummaryPanelEdit").show();
        $(".billingSummaryPanelEdit input:text").keypress(function(evt) {
            if (evt.which === 46) {
                if (/\./.test($(this).val()) === true) {
                    evt.preventDefault();
                }
            } else if (evt.which > 31) {
                if (evt.which < 48 || evt.which > 57) {
                    evt.preventDefault();
                } else {
                    var value = $(this).val();
                    var newVal = value + (evt.which - 48);
                    if (parseInt(newVal) >= 100000000) {
                        evt.preventDefault();
                    }
                }

            }
        });
        $(".billingSummaryPanelEdit input:text").bind('paste', function() {
            var original = $(this).val();
            var e = this;
            setTimeout(function() {
                var newValue = $(e).val();
                if (isNaN(newValue)) {
                    $(e).val(original);
                }
            }, 5);
        });
    });

    $(".jsCancelBillingSummaryEdit").click(function(e) {
        closePopup();
        $(".billingSummaryPanel").show();
        $(".billingSummaryPanelEdit").hide();
    });
    $(".jsSaveAccountInterestNotePopup").click(function(e) {
        if ($.trim($('.changeAccountInterestNotesPopup textarea').val()).length == 0) {
            alert('Please add the account note.');
            return;
        }
        closePopup();
        addAccountNote(context, accountId, $('.changeAccountInterestNotesPopup textarea').val());
        refreshNotes(context, accountId);
        saveBillingSummary(context, accountId);
        $(".billingSummaryPanel").show();
        $(".billingSummaryPanelEdit").hide();
    });
    $(".jsSavelBillingSummaryEdit").click(function(e) {
        var tab = $('.billingSummaryPanelEdit');
        var html = "";
        var validated = true;
        var computedDate = $.trim($("input[name='cDate']").val());
        var firstDate = $.trim($("input[name='billingDate']").val());
        var lastDate = $.trim($("input[name='lastCalcDate']").val());
        if (isNaN(Date.parse(computedDate))) {
            html += "<span>Computed Date Code is not correct.</span><br/>";
            validated = false;
        }
        if (isNaN(Date.parse(firstDate))) {
            html += "<span>1st Billing Date is not correct.</span><br/>";
            validated = false;
        }
        if (isNaN(Date.parse(lastDate))) {
            html += "<span>Last Interest Calc is not correct.</span><br/>";
            validated = false;
        }

        if (validated == false) {
            $('.billingValidationError').html(html);
            showPopup(".billingInfoValidationPopup");
            return false;
        }


        $('.changeAccountInterestNotesPopup textarea').val('');
        showPopup(".changeAccountInterestNotesPopup");
    });


    // button trigger end
    // note addition
    $(".jsSaveNotePopup").click(function(e) {
        var value = $.trim($('.newnote textarea').val());
        if (value == '') {
            closePopup();
            showPopup('.emptyNotePopup');
            return;
        }
        addAccountNote(context, accountId, value);
        $('.checkAllRow').prop('checked', false);
        closePopup();
    });

    $('.emptyNewNoteOk').click(function() {
        closePopup();
        showPopup('.accountNotesAddPopup');
    });
    // note update
    $(".jsUpdateNotePopup").click(function(e) {
        var text = $.trim($('#noteEdit').val());
        if (text == '') {
            closePopup();
            showPopup(".noteEmptyPopup");
            return;
        }
        updateNote(context, accountId);
        closePopup();
    });

    $('.emptyNoteOk').click(function() {
        closePopup();
        showPopup(".accountNotesEditPopup");
    });

    // note deletion
    $(".jsDoDelAccountNote").click(function() {
        if (currentDeleteMode == 1) {
            var checked = $("#accountNoteTbl tbody input:checked");
            checked.parents("tr").remove();
            $.each(checked, function() {
                var id = $(this).parents('td').prev('input:hidden').val();
                deleteNote(context, id);
            });
            $('.checkAllRow').prop('checked', false);
        } else {
            var id = currentNote.find('input:hidden').val();
            deleteNote(context, id);
            currentNote.remove();
        }

        if ($("#accountNoteTbl tbody input:checked").length === 0) {
            $('#accountNoteTbl .checkAllRow').prop('checked', false);
        }

        closePopup();
    });

    // click on the note and show the notes pop up
    $(".accountNotesPanel").delegate('tbody td:not(.checkCell)', 'click', function() {
        currentNote = $(this).parent('tr');
        populateNote();
        adjustNavButton();
        showPopup(".accountNotesPopup");
        $('.accountNotesPopup a.jsClipboardCopy').zclip({
            path: context + '/js/ZeroClipboard.swf',
            copy: function() {
                // Bug fix 2
                //showPopup(".accountNoteCopyPopup");
                return $('.viewNotesArea').html();
            }
        });
    });



    // service history related



    $('.dollar').formatCurrency({negativeFormat: '%s-%n'});

});

function reject(context, accountId) {
    if (saveEmployeeInfo(context, accountId) == false) {
        return false;
    }
    var reason = $.trim($('.rejectAccountPopup textarea').val());
    if (reason.length === 0) {
        $('.basicValidationError').html('the reject reason can not be empty');
        closePopup();
        showPopup(".basicInfoValidationPopup");
        return false;
    }
    var validity = {
        accountId: accountId,
        dataCheckStatus: 'DISAPPROVED',
        dataCheckStatusValidator: user.firstName + ' ' + user.lastName,
        dataCheckStatusReason: reason,
        entries: []
    };
    $.each($(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox"), function() {
        if ($(this).prop('checked') == false) {
            validity.entries.push({
                fieldName: $(this).prop('name'),
                valid: false
            });
        }
    });
    $.ajax({
        url: context + '/account/reject',
        type: 'POST',
        async: false,
        contentType: 'application/json',
        data: JSON.stringify(validity),
        success: function(data, text, xhr) {

        },
        error: function(a, b, c) {
            alert(c);
        }
    });
    return true;


}

function checkApproveRejectStatus() {
    var allChecked = true;
    $.each($(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox"), function() {
        if ($(this).prop('checked') == false) {
            allChecked = false;
        }
    });
    return allChecked;
}


function approve(context, accountId) {
    if (saveEmployeeInfo(context, accountId) == false) {
        return false;
    }
    var validity = {
        accountId: accountId,
        dataCheckStatus: 'APPROVED',
        dataCheckStatusValidator: user.firstName + ' ' + user.lastName,
        dataCheckStatusReason: 'APPROVED',
        entries: []
    };
    $.ajax({
        url: context + '/account/approve',
        type: 'POST',
        async: false,
        contentType: 'application/json',
        data: JSON.stringify(validity),
        success: function(data, text, xhr) {

        },
        error: function(a, b, c) {
            alert(c);
        }
    });
}

function validateBasicInfo() {
    var tab = $('.employeeTab');
    var html = "<ul style='list-style-type: square;'>";
    var validated = true;
    if (tab.find('select.accountStatus').val() == 0) {
        html += "<li style='margin-left: 20px;'><span>Please select the account status</span><br/></li>";
        validated = false;
    }

    var state = $("select[name='state']", tab).val();

    var country = $("select[name='country']", tab).val();

    if ((state == "0" || state == '') && country == '197') {
        html += "<li style='margin-left: 20px;'><span>Please select State/Province/Region</span><br/></li>";
        validated = false;
    }
    var date = tab.find("input[name=birthDate]");
    if (isNaN(Date.parse(date.val())) == true) {
        html += "<li style='margin-left: 20px;'><span>The format of birth date is not correct</span><br/></li>";
        validated = false;
    } else if (Date.parse(date.val()) > new Date()) {
        html += "<li style='margin-left: 20px;'><span>Nobody can be born in the future</span><br/></li>";
        validated = false;
    }


    var ssn = tab.find("input[name=ssn1B]").val() + "-" + tab.find("input[name=ssn2B]").val() + "-" + tab.find("input[name=ssn3B]").val();
    if (/^\d{3}-?\d{2}-?\d{4}$/g.test(ssn) == false) {
        html += "<li style='margin-left: 20px;'><span>The format of SSN is not correct</span><br/></li>";
        validated = false;
    }

    var filter = {};
    filter.ssn = ssn;

    var contextR = $('#context').val();
    var accountIdR = $('#accountId').val();

    var numssn = 0;

    $.ajax({
        url: contextR + '/account/search',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(filter),
        async: false,
        success: function(data, text, xhr) {
            numssn = data.items.length;
        },
    });

    var account = getAccount(contextR, accountIdR);

    if (numssn > 0 && ssn !== account.holder.ssn) {

        html += "<li style='margin-left: 20px;'><span>The SSN already exists. Pick another one.</span><br/></li>";
        validated = false;

    }

    var email = tab.find("input[name=email]").val();
    if ($.trim(email) != '' && /^[A-Za-z0-9](([_\.\-]?[a-zA-Z0-9]+)*)@([A-Za-z0-9]+)(([\.\-]?[a-zA-Z0-9]+)*)\.([A-Za-z]{2,})$/g.test($.trim(email)) == false) {
        html += "<li style='margin-left: 20px;'><span>The format of email is not correct</span><br/></li>";
        validated = false;
    }
    var phoneext = tab.find("input[name=phoneExt]").val();
    var phonenum = tab.find("input[name=phoneInput]").val();

    if ($.trim(phoneext) != '' && $.trim(phonenum) == '') {

        html += "<li style='margin-left: 20px;'><span>When you enter phone extension, phone number can not be empty</span><br/></li>";
        validated = false;

    }

    var notEmpty = ['lastName', 'firstName', 'city', 'street1'];
    var fieldName = ['Last Name', 'First Name', 'City', 'Line #1'];
    $.each(notEmpty, function(i) {
        var value = $.trim(tab.find("input[name=" + this + "]").val());

        if (value == '') {
            html += "<li style='margin-left: 20px;'><span>" + fieldName[i] + " is required</span><br/></li>";
            validated = false;
        }
        if (this == 'zipCode' && /^\d{5}(?:[-\s]\d{4})?$/.test(value) == false && value != '') {
            html += "<li style='margin-left: 20px;'><span>The format of " + fieldName[i] + " is not correct.</span><br/></li>";
            validated = false;
        }
    });

    var zipCode = $("input[name='" + "zipCode" + "']", tab);
    if (country == '197' && (/^\d{5}(?:[-\s]\d{4})?$/.test(zipCode.val()) == false || $.trim(zipCode.val()) == '' )) {
            html += "<li style='margin-left: 20px;'><span>The format of zipCode is not correct.</span><br/></li>";
            validated = false;
    }

    var city = $("input[name='" + "city" + "']", tab);
    if (country == '197' && $.trim(city.val()) == '' ) {
            html += "<li style='margin-left: 20px;'><span> City is required</span><br/></li>";
            validated = false;
    }

    html += "</ul>";
    if (validated == false) {
        $('.basicValidationError').html(html);
        showPopup(".basicInfoValidationPopup ");
    }

    return validated;
}
function saveEmployeeInfo(context, accountId, showSuccessBox) {
    if (validateBasicInfo() == false) {
        return false;
    }
    var account = getAccount(context, accountId);
    account.calculationVersions = null;
    account.validity = null;
    account.billingSummary = null;
    var fields = $('.accountBasicInfoPanelEdit input.holder:text').serializeArray();
    $.each(fields, function() {
        if (this.name !== 'birthDate') {
            account.holder[this.name] = this.value;
        } else {
            account.holder[this.name] = Date.parse(this.value);
        }

    });

    fields = $('.accountBasicInfoPanelEdit select.holder').serializeArray();
    $.each(fields, function() {
        if (this.value == 0) {
            account.holder[this.name] = null;
        } else {
            if (account.holder[this.name] == null) {
                account.holder[this.name] = {};
            }
            account.holder[this.name].id = this.value;
        }

    });

    fields = $('.accountBasicInfoPanelEdit input.address:text').serializeArray();
    $.each(fields, function() {
        account.holder.address[this.name] = this.value;
    });

    fields = $('.accountBasicInfoPanelEdit input.ssnB:text').serializeArray();
    var ssn1B = '';
    var ssn2B = '';
    var ssn3B = '';
    $.each(fields, function() {
        if (this.name === 'ssn1B') {
            ssn1B = this.value;

        } else if (this.name === 'ssn2B') {
            ssn2B = this.value;
        } else if (this.name === 'ssn3B') {
            ssn3B = this.value;
        }
    });
    account.holder['ssn'] = ssn1B + "-" + ssn2B + "-" + ssn3B;

    fields = $('.accountBasicInfoPanelEdit select.address').serializeArray();
    $.each(fields, function() {
        if (this.value == 0) {
            account.holder.address[this.name] = null;
        } else {
            if (account.holder.address[this.name] == null) {
                account.holder.address[this.name] = {};
            }
            account.holder.address[this.name].id = this.value;
        }
    });

    fields = $('.accountBasicInfoPanelEdit input.phone:text').serializeArray();
    account.holder.telephone = fields[0].value + '-' + fields[1].value;

    var formType = $('input[name=formType]:checked', '.formTypeDiv').val();

    if(formType && formType !== "" ){
        account.formType.id = formType;

    } else{
       account.formType = null; 
    }



    fields = $('select.accountStatus').serializeArray();
    account.status.id = fields[0].value;
    $.ajax({
        url: context + '/account/saveEmployee',
        type: 'PUT',
        contentType: 'application/json',
        async: false,
        data: JSON.stringify(account),
        success: function(data, text, xhr) {
            var newAccount = getAccount(context, accountId);
            refreshEmployeeInfo(newAccount);
            refreshAccountSummary(newAccount);
            $(".employeeTab .rowCheckStatus").removeClass("rowCheckShow");
            $(".accountBasicInfoPanel").show();
            $(".accountBasicInfoPanelEdit").hide();
            if (showSuccessBox && showSuccessBox === true) {
                showPopup(".confirmSaveEmployeePopup");
            }
        },
        error: function(a, b, c) {
            alert('Fail to save employee, message:' + a.responseText);
            //alert('Fail to save employee, it looks like SSN exists already in the Service Credit System.');
        }
    });

}

function populateEditInfo(context, accountId) {

    $(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox").prop('checked', true);
    var data = getAccount(context, accountId);
    // populate validity information
    var panel = $('.accountBasicInfoPanelEdit');
    $(panel).find('.claimNumber').html('Claim Number : ' + data.claimNumber);
    $(panel).find('.jsCheckStatus').removeClass('checkApproved').removeClass('checkRejected');
    $(panel).find('.rowCheckStatus').removeClass('rowCheckShow').removeClass('rowCheckFailed').removeClass('rowCheckPassed');
    if (data.validity) {
        if (data.validity.dataCheckStatus === 'APPROVED') {
            $(panel).find('.jsCheckStatus').html('Approved').addClass('checkApproved');
            $(panel).find('.checker').html(data.validity.dataCheckStatusValidator);
        } else if (data.validity.dataCheckStatus === 'PENDING') {
            $(panel).find('.jsCheckStatus').html('Unknown').removeClass('checkApproved').removeClass('checkRejected');
            $(panel).find('.checker').html('-');
        } else {
            $(panel).find('.checker').html(data.validity.dataCheckStatusValidator);
            $(panel).find('.jsCheckStatus').html('Rejected').addClass('checkRejected');
            $(panel).find('.rowCheckStatus').addClass('rowCheckShow').addClass('rowCheckPassed');
            $.each(data.validity.entries, function() {
                $(panel).find('.rowCheckStatus').filter("[name='" + this.fieldName + "']").removeClass('rowCheckPassed').addClass('rowCheckFailed');
            });
        }


    } else {
        $(panel).find('.jsCheckStatus').html('Unchecked');
        $(panel).find('.checker').html('-');
    }
    if (data.validity) {
        $.each(data.validity.entries, function() {
            var item = $(".employeeTab .accountBasicInfoPanelEdit .checkValidateInputBox").filter("[name='" + this.fieldName + "']");
            $(item).prop('checked', false);
        });
    }
    var fields = $('.accountBasicInfoPanelEdit input.holder:text');
    $.each(fields, function() {
        if ($(this).prop('name') === 'birthDate') {
            var date = new Date(data.holder.birthDate);
            //$(this).prop('value', (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear());
            $(this).prop('value',formatDateTime(data.holder.birthDate));
        } else {
            $(this).prop('value', data.holder[$(this).prop('name')]);
        }
    });

    fields = $('.accountBasicInfoPanelEdit input.ssnB:text');
    $.each(fields, function() {

        if ($(this).prop('name') === 'ssn1B') {
            $(this).prop('value', data.holder.ssn.substr(0, 3));
        } else if ($(this).prop('name') === 'ssn2B') {
            $(this).prop('value', data.holder.ssn.substr(4, 2));

        } else if ($(this).prop('name') === 'ssn3B') {
            $(this).prop('value', data.holder.ssn.substr(7, 4));

        }
    });

    fields = $('.accountBasicInfoPanelEdit input.address:text');
    $.each(fields, function() {
        $(this).prop('value', data.holder.address[$(this).prop('name')]);
    });

    // get phone
    if (data.holder.telephone != null) {
        var phoneTokens = data.holder.telephone.split('-');
        $('.phone1').val(phoneTokens[0]);
        $('.phone2').val(phoneTokens[1]);
    }


    $.each($('.accountBasicInfoPanelEdit select.holder'), function() {
        if (data.holder[$(this).prop('name')] != null) {
            $(this).prop('value', data.holder[$(this).prop('name')].id);
        } else {
            $(this).prop('value', 0);
        }


    });

    $.each($('.accountBasicInfoPanelEdit select.address'), function() {
        if (data.holder.address[$(this).prop('name')] != null) {
            $(this).prop('value', data.holder.address[$(this).prop('name')].id);
        } else {
            $(this).prop('value', 0);
        }


    });

    $('.accountStatus').val(data.status.id);

    if(data.formType){
        $(".formTypeDiv input:radio[value='" + data.formType.id + "']").trigger('click');

        $.each($(".accountBasicInfoPanelEdit input[name='formType']"), function() {
            if (parseInt($(this).val()) === data.formType.id) {
                $(this).prop('checked', 'checked');
            }
        });
    }
    
}

function updateNote(context, accountId) {
    var createDateParts = $(currentNote).children('td').eq(1).text().split('/');
    var createDate = new Date(createDateParts[2], createDateParts[0] - 1, createDateParts[1]);

    var note = {
        id: $(currentNote).children('input:hidden').val(),
        //date: new Date(),
        date: createDate,
        writer: user.role.name + ', ' + user.firstName,
        text: $('#noteEdit').val(),
        accountId: accountId
    };

    $.ajax({
        url: context + '/account/' + accountId + '/notes',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(note),
        success: function(data, text, xhr) {
            //$(currentNote).children('td').eq(1).html((note.date.getMonth() + 1) + "/" + note.date.getDate() + "/" + note.date.getFullYear());
            //$(currentNote).children('td').eq(1).html((note.date.getMonth() + 1 < 10 ? '0' : '') + (note.date.getMonth() + 1) + "/" + note.date.getDate() + "/" + note.date.getFullYear());
            $(currentNote).children('td').eq(1).html(formatDateTime(note.date));
            $(currentNote).children('td').eq(2).html(note.text);
            $(currentNote).children('td').eq(3).html(note.writer);
        },
        error: function(a, b, c) {
            alert('Fail to update account note, message:' + a.responseText);
        }
    });
}
function saveBillingSummary(context, accountId) {
    var account = getAccount(context, accountId);
    var s = account.billingSummary;
    s.computedDate = Date.parse($('.billingSummaryPanelEdit .billingFields input').eq(0).val());
    s.firstBillingDate = Date.parse($('.billingSummaryPanelEdit .billingFields input').eq(1).val());
    s.lastInterestCalculation = Date.parse($('.billingSummaryPanelEdit .billingFields input').eq(2).val());
    $.each($('.billingSummaryPanelEdit tbody tr'), function() {
        var name = $(this).children('td').eq(0).html();
        var row = this;
        $.each(s.billings, function() {
            if (this.name === name) {
                this.additionalInterest = parseFloat($(row).children('td').eq(2).children('input:text').val());
                this.totalPayments = parseFloat($(row).children('td').eq(3).children('input:text').val());
                this.balance = parseFloat($(row).children('td').eq(4).children('input:text').val());
                this.paymentOrder = parseInt($(row).children('td').eq(5).children('select').val());
            }
        });
    });

    if ($('.billingSummaryPanelEdit tfoot input').prop('checked')) {
        s.stopACHPayments = true;
    } else {
        s.stopACHPayments = false;
    }
    $.ajax({
        url: context + '/account/' + accountId + '/summary',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(s),
        success: function(data, text, xhr) {
            populateBillingSummary(getAccount(context, accountId).billingSummary);
        },
        error: function(a, b, c) {
            alert('Fail to update account summary, message:' + a.responseText);
        }
    });
}
function populateBillingSummary(billingSummary) {
    if (billingSummary == null) {
        $('#billingSummaryTab').hide();
        return;
    } else {
        $('#billingSummaryTab').show();
    }

    var values = [parseDateToString(billingSummary.computedDate),
        parseDateToString(billingSummary.firstBillingDate),
        billingSummary.transactionType,
        parseDateToString(billingSummary.lastDepositDate),
        parseDateToString(billingSummary.lastInterestCalculation),
        parseDateToString(billingSummary.lastTransactionDate)];

    $.each($('.billingSummaryPanel .billingFields .fieldVal'), function(i) {
        $(this).html(values[i]);
    });

    $.each($('.billingSummaryPanel tbody tr'), function(i) {
        var tr = this;
        var name = $(this).children('input:hidden').eq(0).val();
        $.each(billingSummary.billings, function() {
            if (this.name === name) {
                $(tr).children('td').eq(1).html(this.initialBilling);
                $(tr).children('td').eq(2).html(this.additionalInterest);
                $(tr).children('td').eq(3).html(this.totalPayments);
                $(tr).children('td').eq(4).html(this.balance);
                $(tr).children('td').eq(5).html(this.paymentOrder);
                $(tr).children('td').eq(6).children('input').prop('checked', this.frozen);
            }
        });

    });
    $.each($('.billingSummaryPanel tfoot td'), function(i) {
        if (i > 0 && i < 5) {
            $(this).html(sum(billingSummary.billings, i - 1));
        }
        if (i === 5) {
            if (billingSummary.stopACHPayments === true) {
                $(this).children('input').prop('checked', 'checked');
            } else {
                $(this).children('input').removeProp('checked');
            }
        }
    });
    $('.billingSummaryPanelEdit .billingFields input').eq(0).val(values[0]);
    $('.billingSummaryPanelEdit .billingFields input').eq(1).val(values[1]);
    $('.billingSummaryPanelEdit .billingFields input').eq(2).val(values[4]);
    $('.billingSummaryPanelEdit .billingFields .fieldVal').eq(0).html(values[2]);
    $('.billingSummaryPanelEdit .billingFields .fieldVal').eq(1).html(values[3]);
    $('.billingSummaryPanelEdit .billingFields .fieldVal').eq(2).html(values[5]);
    $.each($('.billingSummaryPanelEdit tbody tr'), function(i) {
        var tr = this;
        var name = $(this).children('input:hidden').eq(0).val();
        $(this).children('input:text').addClass('numberField');
        $.each(billingSummary.billings, function() {
            if (this.name === name) {
                $(tr).children('td').eq(1).html(this.initialBilling);
                $(tr).children('td').eq(2).children('input:text').val(this.additionalInterest);
                $(tr).children('td').eq(3).children('input:text').val(this.totalPayments);
                $(tr).children('td').eq(4).children('input:text').val(this.balance);
                $(tr).children('td').eq(5).children('select').val(this.paymentOrder);
            }
        });


    });
    $.each($('.billingSummaryPanelEdit tfoot td'), function(i) {
        if (i > 0 && i < 5) {
            $(this).html(sum(billingSummary.billings, i - 1));
        }
        if (i === 5) {
            if (billingSummary.stopACHPayments === true) {
                $(this).children('input').prop('checked', 'checked');
            } else {
                $(this).children('input').removeProp('checked');
            }
        }
    });
    $('.dollar').formatCurrency({
        negativeFormat: '%s-%n'
    });
}

function sum(values, position) {
    var result = 0;
    $.each(values, function() {
        switch (position) {
            case 0:
                result += this.initialBilling;
                break;
            case 1:
                result += this.additionalInterest;
                break;
            case 2:
                result += this.totalPayments;
                break;
            case 3:
                result += this.balance;
                break;
        }
    });
    return Math.round(result * 100) / 100;
}

function populateNote() {
    $('.accountNotesPopup .viewNotesArea').html($(currentNote).children('td').eq(2).html());
    $('#noteEdit').val($(currentNote).children('td').eq(2).html());
}

function adjustNavButton() {
    $('.notesToNext').removeClass('priBtnDisabled').removeClass('notesToNextDisabled');
    $('.notesToLast').removeClass('priBtnDisabled').removeClass('notesToLastDisabled');
    $('.notesToFirst').removeClass('priBtnDisabled').removeClass('notesToFirstDisabled');
    $('.notesToPrev').removeClass('priBtnDisabled').removeClass('notesToPrevDisabled');
    if ($(currentNote).prev('tr').length === 0) {
        $('.notesToFirst').addClass('priBtnDisabled').addClass('notesToFirstDisabled');
        $('.notesToPrev').addClass('priBtnDisabled').addClass('notesToPrevDisabled');
    }
    if ($(currentNote).next('tr').length === 0) {
        $('.notesToNext').addClass('priBtnDisabled').addClass('notesToNextDisabled');
        $('.notesToLast').addClass('priBtnDisabled').addClass('notesToLastDisabled');
    }
}

function addAccountNote(context, accountId, text) {

    if (text.length !== 0) {

        var note = {
            date: new Date(),
            writer: user.role.name + ', ' + user.firstName,
            text: text,
            accountId: accountId
        };
        $.ajax({
            url: context + '/account/' + accountId + '/notes',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(note),
            success: function(data, text, xhr) {
                note.id = data;
                $('.note-tbody').append(buildNewNoteHtml(note));
            },
            error: function(a, b, c) {
                alert('Fail to add account note, message:' + a.responseText);
            }
        });
    }
}

function buildNewNoteHtml(note) {
    var noteCount = $('.note-tbody tr').length;
    var html = "<tr>";
    html += "<input type='hidden' value='" + note.id + "'/>";
    html += "<td class='checkCell'><input name='checkRow' type='checkbox' value='checkRow'" + (noteCount + 1) + " class='checkRow'/></td>";
    html += "<td>" + parseDateToString(note.date) + "</td>";
    html += "<td class='aLeft'>" + note.text + "</td>";
    html += "<td>" + note.writer + "</td>";
    return html;
}

function deleteNote(context, id) {
    var note = {
        id: id
    };
    $.ajax({
        url: context + '/account/notes',
        type: 'DELETE',
        contentType: 'application/json',
        data: JSON.stringify(note),
        success: function(data, text, xhr) {
            // nothing
        },
        error: function(a, b, c) {
            alert('Fail to delete account note, message:' + a.responseText);
        }
    });
}

function gatherStatementReportData() {
    var context = $('#context').val();
    var accountId = $('#accountId').val();
    var account = getAccount(context, accountId);
    var csd = account.claimNumber;
    var birthDate = new Date(account.holder.birthDate);
    var amountPayment = account.balance;
    var address = account.holder.address.street1 + '<br/>' + account.holder.address.street2 + "<br/>" + account.holder.address.city;
    var accountName = account.holder.firstName + ' ' + account.holder.lastName;
    var serviceType = account.planType;


    var calculateDate = new Date();
    var priorBalanceDue = account.balance;
    var plusInterestOnPriorBalance = priorBalanceDue;
    var balanceDueBeforePayment = account.balance;

    var fersDeposit = 0;

    var postRedeposit = 0;
    var postDeposit = 0;

    var preRedeposit = 0;
    var preDeposit = 0;

    var newBalanceDue = priorBalanceDue;


    var calculationVersion = account.calculationVersions[0];
    if (calculationVersion != null) {
        calculateDate = new Date(calculationVersion.calculationDate);
        var result = calculationVersion.calculationResult;
        if (result != null) {
            plusInterestOnPriorBalance += result.summary.totalInitialInterest;

            var redeposits = result.redeposits;
            var dedeposits = result.dedeposits;

            if (redeposits != null) {
                for (var i = 0; i < redeposits.length; i++) {
                    var item = redeposits[i];
                    if (item.depositType == 'FERS_REDEPOSIT') {
                        fersDeposit += item.total;
                    } else if (item.depositType == 'CSRS_POST_82_PRE_91_REDEPOSIT') {
                        postRedeposit += item.total;
                    } else if (item.depositType == 'CSRS_POST_3_91_REDEPOSIT') {
                        postRedeposit += item.total;
                    } else if (item.depositType == 'CSRS_PRE_10_82_REDEPOSIT') {
                        preRedeposit += item.total;
                    }
                }
            }

            if (dedeposits != null) {
                for (var i = 0; i < dedeposits.length; i++) {
                    var item = dedeposits[i];
                    if (item.depositType == 'FERS_DEPOSIT') {
                        fersDeposit += item.total;
                    } else if (item.depositType == 'CSRS_POST_10_82_DEPOSIT') {
                        postDeposit += item.total;
                    } else if (item.depositType == 'CSRS_PRE_10_82_DEPOSIT') {
                        preDeposit += item.total;
                    }
                }

            }

            if (result.items[0] != null) {
                newBalanceDue -= result.items[0].paymentsApplied;
            }

        }

    }
    var data = {
        csd: csd,
        birthDate: birthDate,
        amountPayment: amountPayment,
        address: address,
        accountName: accountName,
        calculateDate: calculateDate,
        serviceType: serviceType,
        priorBalanceDue: priorBalanceDue,
        plusInterestOnPriorBalance: plusInterestOnPriorBalance,
        balanceDueBeforePayment: balanceDueBeforePayment,
        fersDeposit: fersDeposit,
        postRedeposit: postRedeposit,
        postDeposit: postDeposit,
        preRedeposit: preRedeposit,
        preDeposit: preDeposit,
        newBalanceDue: newBalanceDue
    };
    return data;
}

function renderStatementReport(data) {
    var popup = $('.printStatementPopup');
    // csd
    $('.printNum span', popup).text('CSD #' + data.csd);
    $('.printBirth span', popup).text(formatDateTime(data.birthDate));
    $('.printAcount span', popup).text(formatReportMoney(data.amountPayment));
    $('.printAddressBody', popup).html(data.address);
    $('.printPersonalData .name', popup).text(data.accountName);
    $('.printPersonalData .date span', popup).text(formatDateTime(data.calculateDate));
    $('.printPersonalData .coveredBy span', popup).text(data.serviceType);
    $('.printPersonalData .claimNum span', popup).text('CSD #' + data.csd);

    $('.priorBalanceDue', popup).text(formatReportMoney(data.priorBalanceDue));
    $('.plusInterestOnPriorBalance', popup).text(formatReportMoney(data.plusInterestOnPriorBalance));
    $('.balanceDueBeforePayment', popup).text(formatReportMoney(data.balanceDueBeforePayment));
    $('.amountOfPayment', popup).text(formatReportMoney(data.amountPayment));
    $('.fersDeposit', popup).text(formatReportMoney(data.fersDeposit));
    $('.postRedeposit', popup).text(formatReportMoney(data.postRedeposit));
    $('.postDeposit', popup).text(formatReportMoney(data.postDeposit));
    $('.preRedeposit', popup).text(formatReportMoney(data.preRedeposit));
    $('.preDeposit', popup).text(formatReportMoney(data.preDeposit));
    $('.newBalanceDue', popup).text(formatReportMoney(data.newBalanceDue));
}

function refreshEmployeeInfo(account) {
    $('.balance').html(account.balance);
    var panel = $('.accountBasicInfoPanel');
    var birthDate = new Date(account.holder.birthDate);
    $(panel).find('.jsCheckStatus').removeClass('checkApproved').removeClass('checkRejected');
    $(panel).find('.rowCheckStatus').removeClass('rowCheckShow').removeClass('rowCheckFailed').removeClass('rowCheckPassed');
    if (account.validity) {
        if (account.validity.dataCheckStatus === 'APPROVED') {
            $(panel).find('.jsCheckStatus').html('Approved').addClass('checkApproved');
            $(panel).find('.checker').html(account.validity.dataCheckStatusValidator);
        } else if (account.validity.dataCheckStatus === 'PENDING') {
            $(panel).find('.jsCheckStatus').html('Unchecked').removeClass('checkApproved').removeClass('checkRejected');
            $(panel).find('.checker').html('-');
        } else {
            $(panel).find('.jsCheckStatus').html('Rejected').addClass('checkRejected');
            $(panel).find('.rowCheckStatus').addClass('rowCheckShow').addClass('rowCheckPassed');
            $.each(account.validity.entries, function() {
                $(panel).find('.rowCheckStatus').filter("[name='" + this.fieldName + "']").removeClass('rowCheckPassed').addClass('rowCheckFailed');
                $(panel).find('.checker').html(account.validity.dataCheckStatusValidator);
            });
        }

    } else {
        $(panel).find('.jsCheckStatus').html('Unchecked').removeClass('checkApproved').removeClass('checkRejected');
        $(panel).find('.checker').html('-');
    }

    $(panel).find('.claimNumber').html('Claim Number: ' + account.claimNumber);
    $(panel).find('.status').html(account.status.name);
    $(panel).find('.lastName').html(account.holder.lastName);
    $(panel).find('.firstName').html(account.holder.firstName);
    $(panel).find('.middleInitial').html(account.holder.middleInitial);
    if (account.holder.suffix != null) {
        $(panel).find('.suffix').html(account.holder.suffix.name);
    } else {
        $(panel).find('.suffix').html("");
    }

    //$(panel).find('.birthDate').html((birthDate.getMonth() + 1) + "/" + birthDate.getDate() + "/" + birthDate.getFullYear());
    $(panel).find('.birthDate').html(formatDateTime(birthDate));
    
    $(panel).find('.ssn').html(account.holder.ssn);
    $(panel).find('.telephone').html(account.holder.telephone);
    $(panel).find('.email').html(account.holder.email);
    $(panel).find('.title').html(account.holder.title);
    $(panel).find('.departmentCode').html(account.holder.departmentCode);
    if(account.formType){
        $(panel).find('.formType').html(account.formType.name);
    }
    
    $(panel).find('.street1').html(account.holder.address.street1);
    $(panel).find('.street2').html(account.holder.address.street2);
    $(panel).find('.street3').html(account.holder.address.street3);
    $(panel).find('.street4').html(account.holder.address.street4);
    $(panel).find('.street5').html(account.holder.address.street5);
    $(panel).find('.city').html(account.holder.address.city);
    $(panel).find('.state').html(isNull(account.holder.address.state) ? '' : account.holder.address.state.name);
    $(panel).find('.zipCode').html(isNull(account.holder.address.zipCode) ? '' : account.holder.address.zipCode);
    $(panel).find('.geoCode').html(account.holder.geoCode);
    $(panel).find('.cityOfEmployment').html(account.holder.cityOfEmployment);
    if (account.holder.address.country != null) {
        $(panel).find('.country').html(account.holder.address.country.name);
    } else {
        $(panel).find('.country').html("");
    }
    if (account.holder.stateOfEmployment != null) {
        $(panel).find('.stateOfEmployment').html(account.holder.stateOfEmployment.name);
    } else {
        $(panel).find('.stateOfEmployment').html("");
    }
    $('.dollar').formatCurrency({
        negativeFormat: '%s-%n'
    });
}

function refreshNotes(context, accountId) {
    $.ajax({
        url: context + '/account/' + accountId + '/notes',
        async: false,
        cache: false,
        success: function(data, text, xhr) {
            $('.note-tbody').html('');
            $.each(data, function() {
                $('.note-tbody').append(buildNewNoteHtml(this));
            });
        },
        error: function(a, b, c) {
            alert('Fail to get account notes, message:' + a.responseText);
        }
    });


}

var currentPayments = [];
var modifiedPayments = [];

function refreshPaymentTable(accountId) {
    var context = $('#context').val();
    var canEditPayment = $('#canEditPayment').val() == "true";
    var canDeletePayment = $('#canDeletePayment').val() == "true";
    $.ajax({
        url: context + '/account/' + accountId + '/payments',
        async: true,
        dataType: "json",
        type: "GET",
        cache: false,
        success: function(data) {
            currentPayments = data;
            var theTable = $('#paymentHistoryTbl');
            theTable.find('tbody').html('');
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                var row = $('<tr data-payment-id="' + item.id + '"></tr>');
                if (i % 2 == 0) {
                    row.addClass('even');
                }
                var cell = $('<td class="blankCell jsShowRowAction paymentCell">&nbsp;</td>');
                row.append(cell);
                if (!canDeletePayment) {
                	cell.addClass("cellDisabled");
                }
                cell = $('<td></td>');
                cell.text(item.batchNumber);
                row.append(cell);

                cell = $('<td></td>');
                cell.text(item.blockNumber);
                row.append(cell);

                cell = $('<td></td>');
                cell.text(item.sequenceNumber);
                row.append(cell);

                cell = $('<td></td>');
                cell.text(parseDateToString(item.depositDate));
                row.append(cell);

                cell = $('<td></td>');
                cell.text('$' + item.amount);
                row.append(cell);

                cell = $('<td></td>');
                // https://github.com/nasa/SCRD/issues/47
                cell.text(item.paymentStatus == null ? '' : item.paymentStatus.name);
                row.append(cell);

                cell = $('<td></td>');
                cell.text(item.applyTo == null ? '' : item.applyTo.name);
                row.append(cell);

                cell = $('<td></td>');
                cell.text('Wall-E Service Credit');
                row.append(cell);

                cell = $('<td class="lastCol"></td>');
                // <input name="phRow5" type="checkbox" value="phRow1" checked="checked" class="checkboxInput">
                var theInput = $('<input type="checkbox" class="checkboxInput glcheckbox">');
                if (item.applyToGL) {
                    theInput.prop('checked', true);
                } else {
                    theInput.prop('checked', false);
                }
                if (!canEditPayment) {
                	theInput.prop('disabled', true);
                }
                cell.append(theInput);
                row.append(cell);

                theTable.find('tbody').append(row);
            }

        },
        error: function(error, b, c) {
            alert('fail to get payments for account: ' + error.responseText);
        }
    });
}
