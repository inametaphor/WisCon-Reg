import React, { Component } from 'react';
import {connect} from 'react-redux';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form'
import Modal from 'react-bootstrap/esm/Modal';
import Spinner from 'react-bootstrap/Spinner';

import { addToCart } from '../state/cartActions';
import store from '../state/store';
import { fetchOfferings } from '../state/offeringActions';
import { isValidEmail } from '../util/emailUtil';
import { formatAmount } from '../util/numberUtil';
import { isAdmin } from '../state/authActions';
import { renderAmountAsString, renderPrice } from '../state/offeringFunctions';

class OfferingList extends Component {

    constructor(props) {
        super(props);

        this.state = {
            showModal: false
        }
    }

    componentDidMount() {
        if (this.props.offerings.loading) {
            fetchOfferings();
        }
    }

    render() {
        if (this.props.offerings.loading) {
            return (
                <div className="text-center">
                    <Spinner animation="border" />
                </div>
            );
        } else if (this.props.offerings.regClosed) {
            return (
                <Alert variant="warning">Aw, drat. Registration for WisCon is closed at this time.</Alert>
            )
        } else {

            let offeringList = this.props.offerings.items.map((o) => {
                let highlights = o.highlights.map((h, i) => {
                    return (<li key={o.id.toString + "-" + i.toString()}>{h}</li>)
                })

                if (o.remaining != null && o.remaining <= 0) {
                    return undefined;
                } else if (o.isRestricted && !this.props.isAdmin) {
                    return undefined;
                } else if (o.emphasis) {
                    return (
                        <div className="col" key={'offering-' + o.id}>
                            <div className="card mb-4 rounded-3 shadow-sm border-primary">
                            <div className="card-header py-3 bg-primary text-white">
                                <h5 className="my-0 fw-normal">{o.title}</h5>
                            </div>
                            <div className="card-body">
                                <h1 className="card-title pricing-card-title">{renderPrice(o)}</h1>
                                <ul className="list-unstyled mt-3 mb-4">
                                {this.supplyNotes(o)}
                                {highlights}
                                </ul>
                                <Button size="lg" className="w-100" onClick={()  => this.showModal(o) }>Add to cart</Button>
                            </div>
                            </div>
                        </div>
                    )
                } else {
                    return (
                        <div className="col" key={'offering-' + o.id}>
                            <div className="card mb-4 rounded-3 shadow-sm">
                            <div className="card-header py-3">
                                <h5 className="my-0 fw-normal">{o.title}</h5>
                            </div>
                            <div className="card-body">
                                <h1 className="card-title pricing-card-title">{renderPrice(o)}</h1>
                                <ul className="list-unstyled mt-3 mb-4">
                                {this.supplyNotes(o)}
                                {highlights}
                                </ul>
                                <Button size="lg" className="w-100" onClick={()  => this.showModal(o) } variant="outline-primary">Add to cart</Button>
                            </div>
                            </div>
                        </div>
                    )
                }
            });

            let title = this.state.selectedOffering ? this.state.selectedOffering.title : undefined;
            let description = this.state.selectedOffering ? (<p>{this.state.selectedOffering.description}</p>) : undefined;

            let message = this.state.messages ? this.state.messages.map((e, i)  => {
                return (<Alert variant="danger" key={i}>{e}</Alert>); } ) : undefined;
            let emailLabel = "Email (same as WisCon programming signup, if relevant)";
            if (this.state.selectedOffering && this.state.selectedOffering.emailRequired === 'OPTIONAL') {
                emailLabel = "Email (optional, same as WisCon programming signup, if relevant)"
            }
            let emailOption =  (<Form.Group controlId="formEmail" key="email-field">
                <Form.Label className="sr-only">{emailLabel}</Form.Label>
                <Form.Control className={this.getErrorClass('email')} type="email" placeholder={emailLabel} onChange={(e) => this.setFormValue("email", e.target.value)}/>
                <Form.Text className="text-muted">
                    Provide a current email address to which information about this membership and the upcoming WisCon convention can be
                    sent. This email will not be used or shared for any other purpose without your consent. (If you are also
                    signing up for WisCon programming, please provide the same email address here so that we can match your profiles.)
                </Form.Text>
            </Form.Group>);

            if (this.state.selectedOffering && this.state.selectedOffering.emailRequired === 'NO') {
                emailOption = undefined;
            }

            let amountEntry = undefined;
            if (this.state.selectedOffering && this.state.selectedOffering.suggestedPrice == null &&
                (!this.isVariantSelectionRequired() ||
                (this.isNonFixedPriceVariantPresent(this.state.selectedOffering) &&
                !this.isFixedPriceVariantChosen(this.state.selectedOffering)))) {
                amountEntry = (<Form.Group className="mb-3" controlId="amount">
                    <Form.Label className="sr-only">Amount</Form.Label>
                    <Form.Control className={this.getErrorClass('amount')} type="text" placeholder="Amount... (e.g. 30)" value={this.getFormValue('amount')} onChange={(e) => this.setFormValue('amount', e.target.value)}/>
                    <Form.Text className="text-muted">
                        Please choose the amount you wish provide for this item.
                    </Form.Text>
                </Form.Group>);
            } else if (this.isVariableAmount(this.state.selectedOffering)) {
                let guidance = (this.state.selectedOffering.maximumPrice != null)
                    ? ' Please choose an amount between ' + formatAmount(this.state.selectedOffering.minimumPrice, this.state.selectedOffering.currency) + ' and ' + formatAmount(this.state.selectedOffering.maximumPrice, this.state.selectedOffering.currency) + '.'
                    : ' Please choose an amount greater than or equal to ' + formatAmount(this.state.selectedOffering.minimumPrice, this.state.selectedOffering.currency) + '.';
                amountEntry = (<Form.Group className="mb-3" controlId="amount">
                    <Form.Label className="sr-only">Amount</Form.Label>
                    <Form.Control className={this.getErrorClass('amount')} type="text" placeholder="Amount... (e.g. 30)" value={this.getFormValue('amount')} onChange={(e) => this.setFormValue('amount', e.target.value)}/>
                    <Form.Text className="text-muted">
                        The suggested price for this item ({this.state.selectedOffering.title}) is {formatAmount(this.state.selectedOffering.suggestedPrice, this.state.selectedOffering.currency)}.
                        {guidance}
                    </Form.Text>
                </Form.Group>);
            }

            let questions = (this.state.selectedOffering && this.state.selectedOffering.addPrompts)
                ? [
                    <Form.Check className="mb-3" id="volunteer" key="form-volunteer" onClick={(e) => this.setFormValue('volunteer', e.target.checked)}
                            label="WisCon is entirely run by volunteers. Would you like to receive information about volunteering during the upcoming WisCon convention, or about getting involved in pre-convention organizing?" />,
                    <Form.Check id="newsletter"  key="form-newsletter" onClick={(e) => this.setFormValue('newsletter', e.target.checked)}
                            label="Would you like to subscribe by email to the WisCon / SF3 Newsletter, with updates about future WisCons and other SF3 events and activities?" />,
                    <Form.Text className="text-muted mb-3 ml-4" key="form-newsletter-text">
                            See more information <a href="https://wiscon.net/news/e-newsletter/" target="_blank" rel="noreferrer">here</a>
                    </Form.Text>,
                    <Form.Check className="mb-3" id="snailMail" key="form-snailmail" onClick={(e) => this.setFormValue('snailMail', e.target.checked)}
                            label="Would you like to receive annual reminder postcards by physical mail? (Requires a mailing address)" />
                ]
                : undefined;

            let variantOption = this.isVariantSelectionRequired()
                ? (<Form.Group className="mb-3" controlId="formVariant">
                        <Form.Label className="sr-only">Option</Form.Label>
                        <Form.Control className={this.getErrorClass('variantId')} as="select" value={this.getFormValue('variantId')} onChange={(e) => this.setFormValue("variantId", e.target.value)} key="variant">
                            <option></option>
                            {this.state.selectedOffering.variants.map((v, i) => (<option value={v.id}>{v.name + (v.suggestedPrice != null ? ' - ' + renderAmountAsString(v.suggestedPrice, this.state?.selectedOffering?.currency) : '')}</option>))}
                        </Form.Control>
                        {this.selectedVariantDescription()}
                    </Form.Group>)
                : null;

            let ageField = (this.isAgeRequired()) ? (<Form.Group className="mb-3" controlId="age">
            <Form.Label className="sr-only">Age</Form.Label>
            <Form.Control className={this.getErrorClass('age')} type="text" placeholder="Age (e.g. 18 months)" value={this.getFormValue('age')} onChange={(e) => this.setFormValue("age", e.target.value)}/>
            <Form.Text className="text-muted">
                Please tell us how old the child is as of Memorial Day 2023.
            </Form.Text>
        </Form.Group>) : undefined;

            let addressFields = (this.isAddressRequired())
                ? [
                    <Form.Group controlId="streetLine1" key="streetLine1">
                        <Form.Label className="sr-only">Street Line 1</Form.Label>
                        <Form.Control className={this.getErrorClass('streetLine1')} type="text" placeholder="Street line 1" value={this.getFormValue('streetLine1')} onChange={(e) => this.setFormValue("streetLine1", e.target.value)}/>
                    </Form.Group>,
                    <Form.Group controlId="streetLine2" key="streetLine2">
                        <Form.Label className="sr-only">Street Line 2 (Optional)</Form.Label>
                        <Form.Control type="text" placeholder="Street line 2 (optional)" value={this.getFormValue('streetLine2')} onChange={(e) => this.setFormValue("streetLine2", e.target.value)}/>
                    </Form.Group>,
                    <div className="row" key="cityAndStateProvince">
                        <div className="col-md-4">
                            <Form.Group controlId="city">
                                <Form.Label className="sr-only">City</Form.Label>
                                <Form.Control className={this.getErrorClass('city')} type="text" placeholder="City" value={this.getFormValue('city')} onChange={(e) => this.setFormValue("city", e.target.value)}/>
                            </Form.Group>
                        </div>
                        <div className="col-md-4">
                            <Form.Group controlId="stateOrProvince">
                                <Form.Label className="sr-only">State/Province</Form.Label>
                                <Form.Control className={this.getErrorClass('stateOrProvince')} type="text" placeholder="State or province" value={this.getFormValue('stateOrProvince')} onChange={(e) => this.setFormValue("stateOrProvince", e.target.value)}/>
                            </Form.Group>
                        </div>
                        <div className="col-md-4">
                            <Form.Group controlId="zipOrPostalCode">
                                <Form.Label className="sr-only">Zip/Postal Code</Form.Label>
                                <Form.Control className={this.getErrorClass('zipOrPostalCode')} type="text" placeholder="Zip or postal code" value={this.getFormValue('zipOrPostalCode')} onChange={(e) => this.setFormValue("zipOrPostalCode", e.target.value)}/>
                            </Form.Group>
                        </div>
                    </div>,
                    <Form.Control as="select" value={this.getFormValue('country')} onChange={(e) => this.setFormValue("country", e.target.value)} key="country">
                        <option>Afghanistan</option>
                        <option>Aland Islands</option>
                        <option>Albania</option>
                        <option>Algeria</option>
                        <option>American Samoa</option>
                        <option>Andorra</option>
                        <option>Angola</option>
                        <option>Anguilla</option>
                        <option>Antarctica</option>
                        <option>Antigua and Barbuda</option>
                        <option>Argentina</option>
                        <option>Armenia</option>
                        <option>Aruba</option>
                        <option>Australia</option>
                        <option>Austria</option>
                        <option>Azerbaijan</option>
                        <option>Bahamas</option>
                        <option>Bahrain</option>
                        <option>Bangladesh</option>
                        <option>Barbados</option>
                        <option>Belarus</option>
                        <option>Belgium</option>
                        <option>Belize</option>
                        <option>Benin</option>
                        <option>Bermuda</option>
                        <option>Bhutan</option>
                        <option>Bolivia</option>
                        <option>Bonaire, Sint Eustatius and Saba</option>
                        <option>Bosnia and Herzegovina</option>
                        <option>Botswana</option>
                        <option>Bouvet Island</option>
                        <option>Brazil</option>
                        <option>British Indian Ocean Territory</option>
                        <option>Brunei Darussalam</option>
                        <option>Bulgaria</option>
                        <option>Burkina Faso</option>
                        <option>Burundi</option>
                        <option>Cambodia</option>
                        <option>Cameroon</option>
                        <option>Canada</option>
                        <option>Cape Verde</option>
                        <option>Cayman Islands</option>
                        <option>Central African Republic</option>
                        <option>Chad</option>
                        <option>Chile</option>
                        <option>China</option>
                        <option>Christmas Island</option>
                        <option>Cocos (Keeling) Islands</option>
                        <option>Colombia</option>
                        <option>Comoros</option>
                        <option>Congo</option>
                        <option>Congo, Democratic Republic of the Congo</option>
                        <option>Cook Islands</option>
                        <option>Costa Rica</option>
                        <option>Cote D'Ivoire</option>
                        <option>Croatia</option>
                        <option>Cuba</option>
                        <option>Curacao</option>
                        <option>Cyprus</option>
                        <option>Czech Republic</option>
                        <option>Denmark</option>
                        <option>Djibouti</option>
                        <option>Dominica</option>
                        <option>Dominican Republic</option>
                        <option>Ecuador</option>
                        <option>Egypt</option>
                        <option>El Salvador</option>
                        <option>Equatorial Guinea</option>
                        <option>Eritrea</option>
                        <option>Estonia</option>
                        <option>Ethiopia</option>
                        <option>Falkland Islands (Malvinas)</option>
                        <option>Faroe Islands</option>
                        <option>Fiji</option>
                        <option>Finland</option>
                        <option>France</option>
                        <option>French Guiana</option>
                        <option>French Polynesia</option>
                        <option>French Southern Territories</option>
                        <option>Gabon</option>
                        <option>Gambia</option>
                        <option>Georgia</option>
                        <option>Germany</option>
                        <option>Ghana</option>
                        <option>Gibraltar</option>
                        <option>Greece</option>
                        <option>Greenland</option>
                        <option>Grenada</option>
                        <option>Guadeloupe</option>
                        <option>Guam</option>
                        <option>Guatemala</option>
                        <option>Guernsey</option>
                        <option>Guinea</option>
                        <option>Guinea-Bissau</option>
                        <option>Guyana</option>
                        <option>Haiti</option>
                        <option>Heard Island and Mcdonald Islands</option>
                        <option>Holy See (Vatican City State)</option>
                        <option>Honduras</option>
                        <option>Hong Kong</option>
                        <option>Hungary</option>
                        <option>Iceland</option>
                        <option>India</option>
                        <option>Indonesia</option>
                        <option>Iran, Islamic Republic of</option>
                        <option>Iraq</option>
                        <option>Ireland</option>
                        <option>Isle of Man</option>
                        <option>Israel</option>
                        <option>Italy</option>
                        <option>Jamaica</option>
                        <option>Japan</option>
                        <option>Jersey</option>
                        <option>Jordan</option>
                        <option>Kazakhstan</option>
                        <option>Kenya</option>
                        <option>Kiribati</option>
                        <option>Korea, Democratic People's Republic of</option>
                        <option>Korea, Republic of</option>
                        <option>Kosovo</option>
                        <option>Kuwait</option>
                        <option>Kyrgyzstan</option>
                        <option>Lao People's Democratic Republic</option>
                        <option>Latvia</option>
                        <option>Lebanon</option>
                        <option>Lesotho</option>
                        <option>Liberia</option>
                        <option>Libyan Arab Jamahiriya</option>
                        <option>Liechtenstein</option>
                        <option>Lithuania</option>
                        <option>Luxembourg</option>
                        <option>Macao</option>
                        <option>Macedonia, the Former Yugoslav Republic of</option>
                        <option>Madagascar</option>
                        <option>Malawi</option>
                        <option>Malaysia</option>
                        <option>Maldives</option>
                        <option>Mali</option>
                        <option>Malta</option>
                        <option>Marshall Islands</option>
                        <option>Martinique</option>
                        <option>Mauritania</option>
                        <option>Mauritius</option>
                        <option>Mayotte</option>
                        <option>Mexico</option>
                        <option>Micronesia, Federated States of</option>
                        <option>Moldova, Republic of</option>
                        <option>Monaco</option>
                        <option>Mongolia</option>
                        <option>Montenegro</option>
                        <option>Montserrat</option>
                        <option>Morocco</option>
                        <option>Mozambique</option>
                        <option>Myanmar</option>
                        <option>Namibia</option>
                        <option>Nauru</option>
                        <option>Nepal</option>
                        <option>Netherlands</option>
                        <option>Netherlands Antilles</option>
                        <option>New Caledonia</option>
                        <option>New Zealand</option>
                        <option>Nicaragua</option>
                        <option>Niger</option>
                        <option>Nigeria</option>
                        <option>Niue</option>
                        <option>Norfolk Island</option>
                        <option>Northern Mariana Islands</option>
                        <option>Norway</option>
                        <option>Oman</option>
                        <option>Pakistan</option>
                        <option>Palau</option>
                        <option>Palestinian Territory, Occupied</option>
                        <option>Panama</option>
                        <option>Papua New Guinea</option>
                        <option>Paraguay</option>
                        <option>Peru</option>
                        <option>Philippines</option>
                        <option>Pitcairn</option>
                        <option>Poland</option>
                        <option>Portugal</option>
                        <option>Puerto Rico</option>
                        <option>Qatar</option>
                        <option>Reunion</option>
                        <option>Romania</option>
                        <option>Russian Federation</option>
                        <option>Rwanda</option>
                        <option>Saint Barthelemy</option>
                        <option>Saint Helena</option>
                        <option>Saint Kitts and Nevis</option>
                        <option>Saint Lucia</option>
                        <option>Saint Martin</option>
                        <option>Saint Pierre and Miquelon</option>
                        <option>Saint Vincent and the Grenadines</option>
                        <option>Samoa</option>
                        <option>San Marino</option>
                        <option>Sao Tome and Principe</option>
                        <option>Saudi Arabia</option>
                        <option>Senegal</option>
                        <option>Serbia</option>
                        <option>Serbia and Montenegro</option>
                        <option>Seychelles</option>
                        <option>Sierra Leone</option>
                        <option>Singapore</option>
                        <option>Sint Maarten</option>
                        <option>Slovakia</option>
                        <option>Slovenia</option>
                        <option>Solomon Islands</option>
                        <option>Somalia</option>
                        <option>South Africa</option>
                        <option>South Georgia and the South Sandwich Islands</option>
                        <option>South Sudan</option>
                        <option>Spain</option>
                        <option>Sri Lanka</option>
                        <option>Sudan</option>
                        <option>Suriname</option>
                        <option>Svalbard and Jan Mayen</option>
                        <option>Swaziland</option>
                        <option>Sweden</option>
                        <option>Switzerland</option>
                        <option>Syrian Arab Republic</option>
                        <option>Taiwan, Province of China</option>
                        <option>Tajikistan</option>
                        <option>Tanzania, United Republic of</option>
                        <option>Thailand</option>
                        <option>Timor-Leste</option>
                        <option>Togo</option>
                        <option>Tokelau</option>
                        <option>Tonga</option>
                        <option>Trinidad and Tobago</option>
                        <option>Tunisia</option>
                        <option>Turkey</option>
                        <option>Turkmenistan</option>
                        <option>Turks and Caicos Islands</option>
                        <option>Tuvalu</option>
                        <option>Uganda</option>
                        <option>Ukraine</option>
                        <option>United Arab Emirates</option>
                        <option>United Kingdom</option>
                        <option>United States</option>
                        <option>United States Minor Outlying Islands</option>
                        <option>Uruguay</option>
                        <option>Uzbekistan</option>
                        <option>Vanuatu</option>
                        <option>Venezuela</option>
                        <option>Viet Nam</option>
                        <option>Virgin Islands, British</option>
                        <option>Virgin Islands, U.s.</option>
                        <option>Wallis and Futuna</option>
                        <option>Western Sahara</option>
                        <option>Yemen</option>
                        <option>Zambia</option>
                        <option>Zimbabwe</option>
                    </Form.Control>
            ]
                : undefined;

            return (
                <div>
                    <p>Select from the following options.</p>
                    <div className="row row-cols-1 row-cols-md-3 mb-3 text-center">
                        {offeringList}
                    </div>
                    <Modal show={this.state.showModal}  onHide={() => this.handleClose()} size="lg">
                        <Form>
                            <Modal.Header closeButton>
                                <Modal.Title>{title}</Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                {message}
                                {description}
                                {variantOption}
                                <Form.Group className="mb-3" controlId="formName">
                                    <Form.Label className="sr-only">Name</Form.Label>
                                    <Form.Control className={this.getErrorClass('for')} type="text" placeholder="Name" value={this.getFormValue('for')} onChange={(e) => this.setFormValue("for", e.target.value)}/>
                                    <Form.Text className="text-muted">
                                    Please provide the full name of the person associated with this membership/item. This does not need to
                                    be a wallet name. By default this name will appear on your badge, but you can change your badge name
                                    by logging in at program.wiscon.net.
                                    </Form.Text>

                                </Form.Group>
                                {emailOption}
                                {amountEntry}
                                {ageField}

                                {questions}
                                {addressFields}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button variant="primary" onClick={() => this.addItem()}>
                                    Add to cart
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal>
                </div>
            );
        }
    }

    selectedVariantDescription() {
        if (this.state?.values?.variantId != null) {
            let variants = this.state?.selectedOffering?.variants?.filter(v => v?.id?.toString() === this.state?.values?.variantId);
            if (variants?.length) {
                return (<Form.Text className="text-muted">
                        {variants[0].description}
                    </Form.Text>)
            } else {
                return (<Form.Text className="text-muted">
                        Please choose an option
                    </Form.Text>);
            }
        } else {
            return (<Form.Text className="text-muted">
                Please choose an option
            </Form.Text>);
        }
    }

    supplyNotes(offering) {
        if (offering.remaining && offering.remaining < 10) {
            return (<li className="text-warning">Not many left</li>)
        } else {
            return undefined;
        }
    }

    getErrorClass(name) {
        return this.isFieldInError(name) ? "is-invalid" : "";
    }

    isFieldInError(name) {
        let errors = this.state.errors;
        if (errors) {
            return errors[name];
        } else {
            return false;
        }
    }

    isAddressRequired() {
        let offering = this.state.selectedOffering;
        if (offering) {
            return offering.addressRequired || this.state.values['snailMail'];
        } else {
            return false;
        }
    }

    isAgeRequired() {
        let offering = this.state.selectedOffering;
        if (offering) {
            return offering.ageRequired;
        } else {
            return false;
        }
    }

    isVariableAmount(offering) {
        if (offering?.variants?.length) {
            return false; // we don't consider variants to be "variable", we might consider them "choose your own price"
        } else if (offering) {
            return offering.minimumPrice;
        } else {
            return false;
        }
    }

    isNonFixedPriceVariantPresent(offering) {
        if (offering?.variants?.length) {
            let variant = offering?.variants?.filter(v => v.suggestedPrice == null);
            return variant?.length;
        } else {
            return false;
        }
    }
    isFixedPriceVariantChosen(offering) {
        if (offering?.variants?.length) {
            let variant = this.findVariantById(this.state?.values?.variantId);
            return variant?.suggestedPrice != null;
        } else {
            return false;
        }
    }

    getFormValue(formName) {
        if (this.state.values) {
            return this.state.values[formName] || '';
        } else {
            return '';
        }
    }

    setFormValue(formName, formValue) {
        let state = this.state;
        let value = state.values;
        let newValue = { ...value };
        let errors = this.state.errors || {};
        newValue[formName] = formValue;
        if (formName === 'for') {
            errors[formName] = (this.validateFor(formValue) !== null);
        } else if (formName === 'email') {
            errors[formName] = (this.validateEmail(formValue) !== null);
        } else if (formName === 'amount') {
            errors[formName] = (this.validateAmount(formValue) !== null);
        } else {
            errors[formName] = false;
        }

        if (formName === 'variantId') {
            let variant = this.findVariantById(formValue);
            if (variant?.suggestedPrice != null) {
                newValue["amount"] = '' + formatAmount(variant.suggestedPrice);
            }
        }

        this.setState({
            ...state,
            values: newValue,
            messages: null,
            errors: errors
        });

    }

    findVariantById(variantIdAsString) {
        let variant = this.state?.selectedOffering?.variants?.filter(v => v?.id?.toString() === variantIdAsString);
        return variant?.length ? variant[0] : null;
    }

    toNumber(value) {
        let n = Number(value);
        if (isNaN(n)) {
            return 0;
        } else {
            return n;
        }
    }

    validateEmail(value) {
        let offering = this.state.selectedOffering;

        let message = null;
        if (offering.emailRequired === 'REQUIRED' && (!value || !isValidEmail(value))) {
            message = "Please provide a valid email.";
        } else if (value && !isValidEmail(value)) {
            message = "That email doesn't look quite right.";
        }
        return message;
    }

    validateAmount(value) {
        let offering = this.state.selectedOffering;

        let message = null;
        if (value && !/^(\d*(\.\d{2})?)$/.test(value)) {
            message = "The amount value looks a bit fishy";
        } else if (value === '' || (value === 0 && offering.suggestedPrice == null)) {
            message = "Please provide an amount.";
        } else if (this.isVariableAmount(offering) && offering.minimumPrice != null && value < offering?.minimumPrice) {
            message = "The minimum amount is " + offering.currency + " " + formatAmount(offering.minimumPrice, offering.currency);
        } else if (this.isVariableAmount(offering) && offering.maximumPrice != null && value > offering.maximumPrice) {
            message = "The maximum amount is " + offering.currency + " " + formatAmount(offering.maximumPrice, offering.currency);
        } else if (value === "0") {
            message = "Please choose an amount greater than zero.";
        }
        return message
    }

    validateFor(value) {
        let message = null;
        if (!value) {
            message = "Please provide a name.";
        }
        return message
    }

    isValidForm() {
        let messages = [];
        let values = this.state.values;
        let errors = {};
        {
            let message = this.validateFor(values.for);
            if (message) {
                errors['for'] = true;
                messages.push(message);
            }
        }
        {
            let message = this.validateEmail(values.email);
            if (message) {
                errors['email'] = true;
                messages.push(message);
            }
        }
        {
            let message = this.validateAmount(values.amount);
            if (message) {
                errors['amount'] = true;
                messages.push(message);
            }
        }

        if (this.isVariantSelectionRequired()) {
            if (!values.variantId) {
                errors['variantId'] = true;
                messages.push("Please choose an option from this list");
            }
        }

        if (this.isAddressRequired()) {
            if (!values.streetLine1) {
                errors['streetLine1'] = true;
                messages.push("Please provide a valid address");
            }
            if (!values.city) {
                errors['city'] = true;
                messages.push("Surely your address must have a city.");
            }
            if (!values.stateOrProvince && (values.country === 'United States' || values.country === 'Canada')) {
                errors['stateOrProvince'] = true;
                messages.push("State and/or province is missing.");
            }
            if (!values.zipOrPostalCode && (values.country === 'United States' || values.country === 'Canada')) {
                errors['zipOrPostalCode'] = true;
                messages.push("Zip or postal code is missing.");
            }
        }

        if (messages.length > 0) {
            this.setState({
                ...this.state,
                messages: messages,
                errors: errors
            });
            return false;
        } else {
            return true;
        }
    }

    isVariantSelectionRequired() {
        return this.state?.selectedOffering?.variants != null && this.state?.selectedOffering?.variants?.length > 0;
    }

    showModal(offering) {
        let value = {};
        if (!offering.isMembership) {
            let items = store.getState().cart.items;
            if (items && items.length > 0) {
                let lastItem = items[items.length-1];
                value['for'] = lastItem.for;
            }
        }
        value.amount = offering.suggestedPrice || 0;
        if (offering.suggestedPrice == null) {
            value.amount = '';
        }
        value.country = 'United States';
        this.setState({
            ...this.state,
            showModal: true,
            selectedOffering: offering,
            values: value,
            errors: {},
            messages: null
        });
    }

    addItem() {
        let offering = this.state.selectedOffering;
        let values = this.state.values;
        let uuid = uuidv4();
        let newValues = {
            ...values,
            amount: this.toNumber(values.amount)
        }
        let price = newValues.amount || 0;
        if (this.isValidForm()) {
            axios.post('/api/order_item.php', {
                "orderId": store.getState().cart.orderId,
                "for": values.for,
                "itemUUID": uuid,
                "offering": offering,
                "values": newValues
            })
            .then(res => {
                store.dispatch(addToCart(offering, values.for, newValues, uuid, price));
                this.setState({
                    ...this.state,
                    showModal: false,
                    selectedOffering: null,
                    values: null,
                    messages: null
                });
                })
            .catch(error => {
                if (error.response && error.response.status === 409) {
                    this.setState({
                        ...this.state,
                        messages: [ "Sorry, I think we've just run out of that item." ]
                    });
                    fetchOfferings();
                } else {
                    this.setState({
                        ...this.state,
                        messages: [ "Sorry. There was a probably talking to the server. Try again?" ]
                    });
                }
            });

        }
    }


    handleClose() {
        this.setState({
            ...this.state,
            showModal: false
        });
    }
}

function mapStateToProps(state) {
    return { offerings: state.offerings, isAdmin: isAdmin() };
}

export default connect(mapStateToProps)(OfferingList);