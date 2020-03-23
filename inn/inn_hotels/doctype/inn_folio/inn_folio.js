// Copyright (c) 2020, Core Initiative and contributors
// For license information, please see license.txt
var is_check_in = getUrlVars()['is_check_in'];

frappe.ui.form.on('Inn Folio', {
	onload: function(frm) {
		frm.get_field("folio_transaction").grid.only_sortable();
		make_read_only(frm);
	},
	transfer_to_another_folio: function(frm) {
		if (frm.doc.__islocal !== 1) {
			let trx_selected = frm.get_field("folio_transaction").grid.get_selected();
			if (trx_selected.length === 0) {
				frappe.msgprint('Please select at least one transaction to be transfered');
			}
			else {
				transfer_to_another_folio(frm, trx_selected);
			}
		}
	},
	add_package: function(frm) {
		frappe.msgprint("Coming Soon");
		// TODO: add package in folio
	},
	add_charge: function (frm) {
		add_charge(frm);
	},
	add_payment: function (frm) {
		add_payment(frm);
	},
	add_refund: function (frm) {
		add_refund(frm);
	},
	refresh: function (frm) {
		make_read_only(frm);
		if (frm.doc.__islocal !== 1) {
			if (frm.doc.status === 'Open') {
				toggle_visibility_buttons(frm, 0);
				// Auto update balance if needed
				frappe.call({
					method: 'inn.inn_hotels.doctype.inn_folio.inn_folio.need_to_update_balance',
					args: {
						folio_id: frm.doc.name
					},
					callback: (r) => {
						if (r.message === 1) {
							// update needed
							frappe.call({
								method: 'inn.inn_hotels.doctype.inn_folio.inn_folio.update_balance',
								args: {
									folio_id: frm.doc.name
								},
								callback: (r) => {
									if (r.message) {
										frm.doc.total_debit = r.message[0];
										frm.doc.total_credit = r.message[1];
										frm.doc.balance = r.message[2];
										frm.refresh_field('total_debit');
										frm.refresh_field('total_credit');
										frm.refresh_field('balance');
									}
								}
							});
						}
					}
				});
				// Close folio manually for Folio type master or desk
				if (frm.doc.type !== 'Guest') {
					frm.page.add_menu_item(__('Close Folio'), function () {
						if (frm.doc.balance !== 0) {
							frappe.msgprint("Balance is not 0. There are still transactions needed to be resolved.");
						}
						else {
							close_folio(frm);
						}
					});
				}
			}
			toggle_guest_in_type(frm, 0);
			// Show Reservation Button
			if (frm.doc.reservation_id !== undefined) {
				frm.add_custom_button(__('Show Reservation'), function () {
				let url = frappe.urllib.get_full_url('/desk#Form/Inn%20Reservation/' + frm.doc.reservation_id);
				if (is_check_in === 'true') {
					url = url + '?is_check_in=true'
				}
				var w = window.open(url, "_self");
			});
			}
			// Update Balance Button
			if (frm.doc.status !== 'Cancel') {
				frm.add_custom_button(__('Update Balance'), function () {
					frappe.call({
						method: 'inn.inn_hotels.doctype.inn_folio.inn_folio.need_to_update_balance',
						args: {
							folio_id: frm.doc.name
						},
						callback: (r) => {
							if (r.message === 1) {
								frappe.call({
									method: 'inn.inn_hotels.doctype.inn_folio.inn_folio.update_balance',
									args: {
										folio_id: frm.doc.name
									},
									callback: (r) => {
										if (r.message) {
											frappe.show_alert("Balance updated.");
											frm.doc.total_debit = r.message[0];
											frm.doc.total_credit = r.message[1];
											frm.doc.balance = r.message[2];
											frm.refresh_field('total_debit');
											frm.refresh_field('total_credit');
											frm.refresh_field('balance');
										}
									}
								});
							}
							else {
								frappe.show_alert('Balance already updated.');
							}
						}
					});
				});
			}
		}
		else {
			toggle_visibility_buttons(frm, 1);
			toggle_guest_in_type(frm, 1);
		}
	},
	close: function (frm) {
		if (frm.doc.close < frm.doc.open) {
			frm.set_value('close', null);
			frappe.msgprint('Close Date must be greater than Open Date');
		}
	}
});

frappe.ui.form.on('Inn Folio Transaction', {
	void_transaction: function (frm, cdt, cdn) {
		let child = locals[cdt][cdn];
		void_transaction(child);
	}
});

// Function to extract variable's value passed on URL
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

// Function to make form disabled if status cancel
function make_read_only(frm) {
	let active_flag = 0;
	if (frm.doc.status !== 'Open') {
		active_flag = 1;
	}
	else {
		active_flag = 0;
	}

	frm.set_df_property('sb4', 'hidden', active_flag);
	frm.set_df_property('transfer_to_another_folio', 'hidden', active_flag);
	frm.set_df_property('open', 'read_only', active_flag);
	frm.set_df_property('close', 'read_only', active_flag);
	frm.set_df_property('reservation_id', 'read_only', active_flag);
	frm.set_df_property('customer_id', 'read_only', active_flag);
	frm.set_df_property('type', 'read_only', active_flag);
	frm.set_df_property('group_id', 'read_only', active_flag);

	frappe.meta.get_docfield('Inn Folio Transaction', 'void_transaction', frm.doc.name).hidden = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'flag', frm.doc.name).read_only = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'transaction_type', frm.doc.name).read_only = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'amount', frm.doc.name).read_only = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'debit_account', frm.doc.name).read_only = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'credit_account', frm.doc.name).read_only = active_flag;
	frappe.meta.get_docfield('Inn Folio Transaction', 'remark', frm.doc.name).read_only = active_flag;

}

// Function to toggle visibility of buttons when necessary
function toggle_visibility_buttons(frm, active_flag) {
	frm.set_df_property('sb4', 'hidden', active_flag);
	frm.set_df_property('transfer_to_another_folio', 'hidden', active_flag);
}

// Function to toggle visibility of Guest options in Type
function toggle_guest_in_type(frm, is_new) {
	if (is_new === 1) {
		frm.set_df_property('type', 'options', ['Master', 'Desk'])
	}
	else {
		if (frm.doc.type === 'Guest') {
			frm.set_df_property('type', 'read_only', 1);
			frm.set_df_property('type', 'options', ['Guest', 'Master', 'Desk'])
		}
		else {
			frm.set_df_property('type', 'options', ['Master', 'Desk'])
		}
	}
	frm.refresh_field('type');
}

// Function to show pop up Dialog for adding new charge to the folio
function add_charge(frm) {
	frappe.call({
		method: 'inn.inn_hotels.doctype.inn_folio_transaction_type.inn_folio_transaction_type.get_transaction_type',
		args: {
			type: 'Debit'
		},
		callback: (r)=> {
			let fields = [
				{
					'label': __('Transaction Type'),
					'fieldname': 'transaction_type',
					'fieldtype': 'Select',
					'options': r.message,
					'reqd': 1
				},
				{
					'fieldname': 'accb0',
					'fieldtype': 'Column Break'
				},
				{
					'label': __('Amount'),
					'fieldname': 'amount',
					'fieldtype': 'Currency',
					'columns': 2,
					'reqd': 1
				},
				{
					'fieldname': 'accb1',
					'fieldtype': 'Column Break'
				},
				{
					'label': __('Sub Folio'),
					'fieldname': 'sub_folio',
					'fieldtype': 'Select',
					'options': [
						{'label': __('A'), 'value': 'A'}, {'label': __('B'), 'value': 'B'},
						{'label': __('C'), 'value': 'C'}, {'label': __('D'), 'value': 'D'}
						],
					'default': 'A',
					'reqd':1
				},
				{
					'fieldname': 'acsb0',
					'fieldtype': 'Section Break'
				},
				{
					'label': 'Remark',
					'fieldname': 'remark',
					'fieldtype': 'Small Text',
				},
			];
			var d = new frappe.ui.Dialog({
				title: __('Add New Charge for Folio ' + frm.doc.name),
				fields: fields,
			});
			d.set_primary_action(__('Save'), () => {
				let remark_to_save = '';
				if (d.get_values().remark !== undefined || d.get_values().remark != null) {
					remark_to_save = d.get_values().remark;
				}
				frappe.call({
					method: 'inn.inn_hotels.doctype.inn_folio_transaction.inn_folio_transaction.add_charge',
					args: {
						transaction_type: d.get_values().transaction_type,
						amount: d.get_values().amount,
						sub_folio: d.get_values().sub_folio,
						remark: remark_to_save,
						parent: frm.doc.name
					},
					callback: (r) => {
						if (r.message) {
							frappe.msgprint('Charge with ID ' + r.message + " successfully added");
							frm.reload_doc();
						}
					}
				});
				d.hide();
			});
			d.show();
		}
	});
}

// Function to show pop up Dialog for adding new payment to the folio
function add_payment(frm) {
	frappe.call({
		method: 'inn.inn_hotels.doctype.inn_folio_transaction_type.inn_folio_transaction_type.get_transaction_type',
		args: {
			type: 'Credit'
		},
		callback: (r)=> {
			let fields = [
				{
					'label': __('Transaction Type'),
					'fieldname': 'transaction_type',
					'fieldtype': 'Select',
					'options': r.message,
					'reqd': 1
				},
				{
					'fieldname': 'accb0',
					'fieldtype': 'Column Break'
				},
				{
					'label': __('Amount'),
					'fieldname': 'amount',
					'fieldtype': 'Currency',
					'columns': 2,
					'reqd': 1
				},
				{
					'fieldname': 'acsb0',
					'fieldtype': 'Section Break'
				},
				{
					'label': __('Mode of Payment'),
					'fieldname': 'mode_of_payment',
					'fieldtype': 'Link',
					'options': 'Mode of Payment',
					'reqd': 1
				},
				{
					'fieldname': 'accb1',
					'fieldtype': 'Column Break'
				},
				{
					'label': __('Sub Folio'),
					'fieldname': 'sub_folio',
					'fieldtype': 'Select',
					'options': [
						{'label': __('A'), 'value': 'A'}, {'label': __('B'), 'value': 'B'},
						{'label': __('C'), 'value': 'C'}, {'label': __('D'), 'value': 'D'}
						],
					'default': 'A',
					'reqd':1
				},
				{
					'fieldname': 'acsb1',
					'fieldtype': 'Section Break'
				},
				{
					'label': 'Remark',
					'fieldname': 'remark',
					'fieldtype': 'Small Text',
				},
			];
			var d = new frappe.ui.Dialog({
				title: __('Add New Payment for Folio ' + frm.doc.name),
				fields: fields,
			});
			d.set_primary_action(__('Save'), () => {
				let remark_to_save = '';
				if (d.get_values.remark !== undefined) {
					remark_to_save = d.get_values.remark;
				}
				frappe.call({
					method: 'inn.inn_hotels.doctype.inn_folio_transaction.inn_folio_transaction.add_payment',
					args: {
						transaction_type: d.get_values().transaction_type,
						amount: d.get_values().amount,
						mode_of_payment: d.get_values().mode_of_payment,
						sub_folio: d.get_values().sub_folio,
						remark: remark_to_save,
						parent: frm.doc.name
					},
					callback: (r) => {
						if (r.message) {
							frappe.msgprint('Payment with ID ' + r.message + " successfully added");
							frm.reload_doc();
						}
					}
				});
				d.hide();
			});
			d.show();
		}
	});
}

// Function to show pop up Dialog for Adding Refund to folio
function add_refund(frm) {
	var d = new frappe.ui.Dialog({
		title: __('Add New Refund to Folio ' + frm.doc.name),
		fields: [
			{
				'label': __('Amount'),
				'fieldname': 'amount',
				'fieldtype': 'Currency',
				'columns': 2,
				'reqd': 1
			},
			{
				'fieldname': 'arcb0',
				'fieldtype': 'Column Break'
			},
			{
				'label': __('Sub Folio'),
				'fieldname': 'sub_folio',
				'fieldtype': 'Select',
				'options': [
					{'label': __('A'), 'value': 'A'}, {'label': __('B'), 'value': 'B'},
					{'label': __('C'), 'value': 'C'}, {'label': __('D'), 'value': 'D'}
					],
				'default': 'A',
				'reqd':1
			},
			{
				'fieldname': 'arsb0',
				'fieldtype': 'Section Break'
			},
			{
				'label': 'Remark',
				'fieldname': 'remark',
				'fieldtype': 'Small Text',
			},
		]
	});
	if (frm.doc.balance > 0) {
		d.set_value('amount', frm.doc.balance);
	}
	d.set_primary_action(__('Save'), () => {
		let remark_to_save = '';
		if (d.get_values.remark !== undefined) {
			remark_to_save = d.get_values.remark;
		}
		frappe.call({
			method: 'inn.inn_hotels.doctype.inn_folio_transaction.inn_folio_transaction.add_charge',
			args: {
				transaction_type: 'Refund',
				amount: d.get_values().amount,
				sub_folio: d.get_values().sub_folio,
				remark: remark_to_save,
				parent: frm.doc.name
			},
			callback: (r) => {
				if (r.message) {
					frappe.msgprint('Refund with ID ' + r.message + " successfully added");
					frm.reload_doc();
				}
			}
		});
		d.hide();
	});
	d.show();
}

// Function to show pop up Dialog for transferring transaction selected to another folio
function transfer_to_another_folio(frm, trx_selected) {
	var d = new frappe.ui.Dialog({
		title: __('Transfer Transactions to Another Folio'),
		fields: [
			{
				'label': 'Transfer to Folio: ',
				'fieldname': 'receiving_folio',
				'fieldtype': 'Link',
				'options': 'Inn Folio',
				'get_query': function () {
					return {
						filters: [
							['Inn Folio', 'name', '!=', frm.doc.name],
							['Inn Folio', 'status', '=', 'Open'],
						]
					}
				},
				reqd: 1
			},
		]
	});
	d.set_primary_action(__('Transfer'), () => {
		frappe.call({
			method: 'inn.inn_hotels.doctype.inn_folio.inn_folio.transfer_to_another_folio',
			args: {
				trx_list: trx_selected,
				old_parent: frm.doc.name,
				new_parent: d.get_values().receiving_folio,
			},
			callback: (r) => {
				if (r.message === 0) {
					frappe.msgprint('Transactions  transfered to Folio ' + d.get_values().receiving_folio + ' successfully');
					frm.reload_doc();
				}
			}
		});
		d.hide();
	});
	d.show();
}

// Function to void single folio transaction
function void_transaction(child) {
	frappe.confirm(__("You are about to void this transaction. Are you sure?"), function () {
		if (child.is_void === 0) {
			child.is_void = 1;
			cur_frm.save();
			frappe.show_alert('Transaction with ID ' + child.name + ' voided successfully.');
		}
		else {
			frappe.msgprint("This transaction already voided.");
		}
	});
}

// Function to manually close folio
function close_folio(frm) {
	frappe.confirm(__("You are about to Close this Folio. Are you sure?"), function () {
		frm.set_value('status', 'Closed');
		frm.save()
		frappe.show_alert("Folio Closed successfully");
	});
}