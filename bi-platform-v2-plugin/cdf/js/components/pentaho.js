/*!
* Copyright 2002 - 2013 Webdetails, a Pentaho company.  All rights reserved.
* 
* This software was developed by Webdetails and is provided under the terms
* of the Mozilla Public License, Version 2.0, or any later version. You may not use
* this file except in compliance with the license. If you need a copy of the license,
* please go to  http://mozilla.org/MPL/2.0/. The Initial Developer is Webdetails.
*
* Software distributed under the Mozilla Public License is distributed on an "AS IS"
* basis, WITHOUT WARRANTY OF ANY KIND, either express or  implied. Please refer to
* the license for the specific language governing your rights and limitations.
*/

/*
 * corePentaho.js
 *
 * Includes all components relating to XActions, PRPTs, JPivot, and other
 * Pentaho-owned technologies.
 */

// TODO: could really use some refactoring: iframes, options, post

var XactionComponent = BaseComponent.extend({
  update : function() {
    var myself=this;
    try {
      if (typeof(this.iframe) == 'undefined' || !this.iframe) {
        // go through parameter array and update values
        var p = new Array(this.parameters?this.parameters.length:0);
        for(var i= 0, len = p.length; i < len; i++){
          var key = this.parameters[i][0];
          var value = this.parameters[i][1] == "" ? this.parameters[i][2] : Dashboards.getParameterValue(this.parameters[i][1]);
          if(this.value == "NIL"){
            this.value = this.parameters[i][2];
          }
          p[i] = [key,value];
        }

        if (typeof(this.serviceMethod) == 'undefined' || this.serviceMethod == 'ServiceAction') {
          var jXML = Dashboards.callPentahoAction(myself,this.path, p,null);

          if(jXML != null){
            $('#'+myself.htmlObject).html(jXML.find("ExecuteActivityResponse:first-child").text());
          }
        } else {
          var html = Dashboards.pentahoServiceAction(this.serviceMethod, 'html', this.path, p, null);
          $('#'+myself.htmlObject).html(html);
        }

      } else {
        var xactionIFrameHTML = "<iframe id=\"iframe_"+ this.htmlObject + "\"" +
        " frameborder=\"0\"" +
        " height=\"100%\"" +
        " width=\"100%\" />";        
        var iframe = $(xactionIFrameHTML);        
        
    //var url = webAppPath + "/ViewAction?solution=" + this.solution + "&path=" + this.path + "&action=" + this.action + "&"; //legacy
    var ts = "ts=" + new Date().getTime() + "&";
    var url = webAppPath + "/api/repos/" + this.path.replace(/\//g, ':') + "/xaction?" + ts;

        // Add args
        var p = new Array(this.parameters.length);
        for(var i= 0, len = p.length; i < len; i++){
          var arg = "&" + encodeURIComponent(this.parameters[i][0]) + "=";
          var val = "";
          if (this.parameters[i][1] == "") {
            val = encodeURIComponent(this.parameters[i][2]);
          } else {
            val =  encodeURIComponent(Dashboards.getParameterValue(this.parameters[i][1]));
            if(val == "NIL"){
              val = encodeURIComponent(this.parameters[i][2])
            }
          }
          url += arg + val;
        }
        if (!this.loading) {
          this.loading = true;
          Dashboards.incrementRunningCalls();
        }
        iframe.load(function(){
          if (this.contentWindow.document.body.innerHTML){
            myself.loading = false;
            Dashboards.decrementRunningCalls();
          }
        });
        $("#"+this.htmlObject).empty().append(iframe);
        iframe[0].contentWindow.location = url;
      }
    } catch (e) {
    // don't cause the rest of CDF to fail if xaction component fails for whatever reason
    }
  }
});

var JpivotComponent = BaseComponent.extend({
  update : function() {
    //to be backwards compatible set default value for iframeScolling
    // also added 20px 
    if(this.iframeScrolling == undefined){
      this.iframeScrolling="no";
    }
     // Build IFrame and set url
    var jpivotHTML = "<iframe id=\"jpivot_"+ this.htmlObject + "\" scrolling=\""+this.iframeScrolling+"\" onload=\"var dynamicHeight = this.contentWindow.document.body.offsetHeight+50; this.style.height = dynamicHeight + 'px';\" frameborder=\"0\" height=\""+this.iframeHeight+"\" width=\""+this.iframeWidth+"\" src=\"";
    jpivotHTML += webAppPath + "/api/repos/" + this.path.replace(/\//g, ':') + "/xaction?" ;

    // Add args
    var p = new Array(this.parameters.length);
    for(var i= 0, len = p.length; i < len; i++){
      var arg = "&" + this.parameters[i][0] + "=";
      jpivotHTML += arg +  Dashboards.getParameterValue(this.parameters[i][1]);
    }

    // Close IFrame
    jpivotHTML += "\"></iframe>";

    $("#"+this.htmlObject).html(jpivotHTML);
  }
});

var PivotLinkComponent = BaseComponent.extend({
  update : function() {}
},{
  openPivotLink : function(object) {
    var url = webAppPath + "/Pivot?solution=system&path=pentaho-cdf/actions&action=jpivot.xaction&";

    var qd = object.pivotDefinition;
    var parameters = [];
    for(p in qd){
      var key = p;
      var value = typeof qd[p]=='function'?qd[p]():qd[p];
      //alert("key: " + key + "; Value: " + value);
      parameters.push(key + "=" + encodeURIComponent(value));
    }
    url += parameters.join("&");

    var _href = url.replace(/'/g,"&#39;");
    $.fancybox({
      type:"iframe",
      href:_href,
      width: $(window).width(),
      height:$(window).height()
    });
  }
});


var PrptComponent = BaseComponent.extend({

  getIframeName : function() {
    return this.htmlObject + '_' + 'prptFrame';
  },

  getIframe: function() {
    return '<iframe name="' + this.getIframeName() + '" style="width:100%;height:100%;border:0px" frameborder="0"/>';
  },

 /*************************************************************************
  * We really shouldn't mess around with the CDF running call counter,
  * but if we don't do so in this case, the report will count as "finished"
  * even though nothing has been loaded into the iframe. We'll increment it
  * here,decrement it again from the iframe's onload event.
  */

  startLoading: function() {
    if (!this.loading) {
      this.loading = true;
      Dashboards.incrementRunningCalls();
    }
  },

  stopLoading: function() {
    if (this.loading) {
      this.loading = false;
      Dashboards.decrementRunningCalls();
    }
  },
  /*************************************************************************/
  //util function to compose paths - solution:path:action
  composePath: function(options) {
    var clean = function(segment) {
      if (segment.charAt(0) == ":") {
        segment = segment.substring(1,segment.length);
      }
      if (segment.charAt(segment.length - 1) == ":") {
        segment = segment.substring(0,segment.length - 1);
      }
      return segment
    };
    var solution = options.solution != undefined ? options.solution.replace(/\//g, ':') : "";
    var path =  options.path != undefined ? options.path.replace(/\//g, ':') : ".";
    var action =  options.action != undefined ? options.action.replace(/\//g, ':') : "";
    var fullPath = ":";
    if (solution != "") {
      fullPath += clean(solution) + ":";
    }
    if (path != "") {
      fullPath += clean(path);
    }
    if (action != "") {
      fullPath += ":" + clean(action);
    }
    return fullPath;
  },
  /*************************************************************************/

  update: function(){
 
    this.clear();
    var ts = "ts=" + new Date().getTime();
    var options = this.getOptions(),
      params = this.getParams(),
      reportOptions = this.getReportOptions();

    $.each(reportOptions, function(key, value){
      if(params[key] != undefined){
        delete key;
      } 
    });

    var pathSegments = {
      solution: options.solution,
      path: options.path,
      action: options.action
    }    
    //we don't want to pass these as parameters
    delete options.solution;
    delete options.path;
    delete options.action;
    delete reportOptions.solution;
    delete reportOptions.path;
    delete reportOptions.action;
    
    var downloadMode = this.downloadMode;    // if you really must use this component to download stuff
    var callVar = options.showParameters ? 'viewer' : 'report';
    if (downloadMode == null) {
      var outputTarget = options["output-target"];
      // take a guess
      downloadMode =
        !((outputTarget.indexOf('html') != -1 &&
           outputTarget.indexOf('mime-message') == -1)
          || outputTarget.indexOf('text') != -1);
    }    
    if(options["dashboard-mode"]){
      //IFrame = False, showParameters always false.
      if(options.showParameters) {
        Dashboards.log("showParameters not supported with IFrame = False");
      }
      var requestType = this.usePost ? "POST" : "GET";
      var url = webAppPath + '/api/repos/' + this.composePath(pathSegments) + '/report?' + ts;
      $.each(reportOptions, function(key, value){
          if(params[key] == undefined) {
            params[key] = value;
          }
        });
      var myself=this;
      $.ajax({
        url: url,
        type: requestType,
        data: params,
        dataType:"html",
        success: function(resp){
          $("#"+myself.htmlObject).html(resp);
        }
      });
    }
    else {
      // set up our result iframe
      var iframe = $(this.getIframe());
      var htmlObj = $('#' + this.htmlObject);
      htmlObj.empty();
      iframe = iframe.appendTo(htmlObj);

      if (this.autoResize) {
        // we'll need to reset size before each resize,
        // otherwise we'll get stuck with the size of the biggest report we get
        if (this._sHeight == null) {
          this._sHeight = htmlObj.height();
          this._sWidth = htmlObj.width();
        }
        else {
          htmlObj.height(this._sHeight);
          htmlObj.width(this._sWidth);
        }
      }

      if (this.usePost) {

        $.each(options, function(key, value){
          if(params[key] == undefined) {
            params[key] = value;
          }
        });
        var url = webAppPath + '/api/repos/' + this.composePath(pathSegments) + '/' + callVar + '?' + ts;
        this._postToUrl(htmlObj, iframe, url, params, this.getIframeName());

      } else {

        var url = webAppPath + '/api/repos/' + this.composePath(pathSegments) + '/' + callVar + '?' + ts + "&" + $.param(options);

        if (options.showParameters && this.autoResize) {
          Dashboards.log('PrptComponent: autoResize disabled because showParameters=true');
          this.autoResize = false;
        }

        this.startLoading();
        var myself = this;
        iframe.load(function(){
          if( options.showParameters ) {
            var jqBody = $(this.contentWindow.document.body);
            var reportContentFrame = jqBody.find('#reportContent');
            reportContentFrame.load(function() {
              if (myself.autoResize) {
                myself._resizeToReportFrame(reportContentFrame[0],htmlObj, options);
               }
             });
          }
          myself.stopLoading();
        });
        iframe[0].contentWindow.location = url;
      }
      if (downloadMode) {
        // if call prompts a download window we'll never know when it's done
        this.stopLoading();
      }
    }
  },

  /**
   * report options
   **/
  getOptions: function() {
    var options = {
      paginate : this.paginate || false,
      showParameters: this.showParameters || false,
      autoSubmit: (this.autoSubmit || this.executeAtStart) || false,
      "dashboard-mode": this.iframe==undefined?false:!this.iframe,
      solution: this.solution,
      path: this.path,
      action: this.action,
      renderMode: 'REPORT',
      htmlProportionalWidth:false
    };

    if (this.paginate) {
      options["output-target"] = "table/html;page-mode=page";
      options['accept-page'] = 0;
    } else {
      options["output-target"] = "table/html;page-mode=stream";
      options['accept-page'] = -1;
    }

    // update options with report parameters
    for (var i=0; i < this.parameters.length; i++ ) {
      // param: [<prptParam>, <dashParam>, <default>]
      var param = this.parameters[i];
      var value = Dashboards.getParameterValue(param[1]);
      if(value == null && param.length == 3) {
        value = param[2];
      }
      options[param[0]] = value;
    }

    return options;

  },

  getParams: function(){
    var options = {};

    if (this.paginate) {
      options["output-target"] = "table/html;page-mode=page";
      options['accept-page'] = 0;
    } else {
      options["output-target"] = "table/html;page-mode=stream";
      options['accept-page'] = -1;
    }

    // update options with report parameters
    for (var i=0; i < this.parameters.length; i++ ) {
      // param: [<prptParam>, <dashParam>, <default>]
      var param = this.parameters[i];
      var value = Dashboards.getParameterValue(param[1]);
      if(value == null && param.length == 3) {
        value = param[2];
      }
      options[param[0]] = value;
    }

    return options;
  },

  getReportOptions: function(){
    var options = {
      paginate : this.paginate || false,
      showParameters: this.showParameters || false,
      autoSubmit: (this.autoSubmit || this.executeAtStart) || false,
      "dashboard-mode": this.iframe==undefined?false:!this.iframe,
      solution: this.solution,
      path: this.path,
      name: this.action,
      renderMode: 'REPORT',
      htmlProportionalWidth:false,
      'accepted-page':-1
    };

    if (this.paginate) {
      options["output-target"] = "table/html;page-mode=page";
      options['accept-page'] = 0;
    } else {
      options["output-target"] = "table/html;page-mode=stream";
      options['accept-page'] = -1;
    }

    return options;
  },


  _postToUrl : function (htmlObj, iframe, path, params, target) {
    this.startLoading();
    // use a form to post, response will be set to iframe
    var form = this._getParamsAsForm(document, path, params, this.getIframeName());
    htmlObj[0].appendChild(form);

    var self = this;
    iframe.load(function() {
      if(self.autoResize) {
        self._resizeToReportFrame(iframe[0], htmlObj, params);
      }
      self.stopLoading();
    });

    form.submit();
  },

  _resizeToReportFrame : function(iframe, htmlObj, options) {
    var outputTarget = options["output-target"];
    // only makes sense for html, but let's keep it open
    var isHtml = function(outputTarget) {
      return outputTarget.indexOf('html') != -1 
            && outputTarget.indexOf('mime') == -1;
    };
    var isText = function(outputTarget) {
      return outputTarget.indexOf('text') != -1;
    };
    var isXml = function(outputTarget) {
      return outputTarget.indexOf('xml') != -1;
    };
    try {
      var idoc = iframe.contentWindow.document;
      if (iframe.contentWindow.document) {
        var sized = null;
        if (isHtml(outputTarget) || isText(outputTarget)) {
          sized = idoc.body;
        }
        else if (isXml(outputTarget)) {
          // not much point in using this
          sized = idoc.firstChild;
        }

        if (sized != null) {
          var hMargin=0, wMargin=0;
          if (isHtml(outputTarget)) {
            // margins may not be taken into account in scrollHeight|Width
            var jsized = $(sized);
            hMargin = jsized.outerHeight(true) - jsized.outerHeight(false);
            wMargin = jsized.outerWidth(true) - jsized.outerWidth(false);
          }
          htmlObj.height(sized.scrollHeight + hMargin);
          htmlObj.width(sized.scrollWidth + wMargin);
        }
      }
    } catch(e) {
      Dashboards.log(e);
    }
  },

  _getParamsAsForm : function (doc, path, params, target) {
    var form = doc.createElement("form");
    form.setAttribute("method", "post");
    form.setAttribute("action", path);
    form.setAttribute("target", target);
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        var param = params[key];
        if ($.isArray(param)) {
          for(var i = 0; i < param.length; i++){
            var hiddenField = doc.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", param[i]);
            form.appendChild(hiddenField);
          }
        }
        else {
          var hiddenField = doc.createElement("input");
          hiddenField.setAttribute("type", "hidden");
          hiddenField.setAttribute("name", key);
          hiddenField.setAttribute("value", param);
          form.appendChild(hiddenField);
        }
      }
    }
    return form;
  }

});//PrptComponent

var SchedulePrptComponent = PrptComponent.extend({
visible:false,

update : function() {
    // 2 modes of working; if it's a div, create a button inside it
    var myself = this;
    var o = $("#"+ this.htmlObject);
    if ($.inArray(o[0].tagName.toUpperCase(),["SPAN","DIV"]) > -1){
      // create a button
      o = $("<button/>").appendTo(o.empty());
      if (o[0].tagName=="DIV") o.wrap("<span/>");
      if (this.label != undefined) o.text(this.label);
      o.button();
      o.addClass('scheduler_button');
    }
    o.unbind("click"); // Needed to avoid multiple binds due to multiple updates(ex:component with listeners)
    o.bind("click", function(){
      var success = typeof(myself.preChange)=='undefined' ? true : myself.preChange();
      if(success) {
        myself.schedulePrptComponent();
      }
      typeof(myself.postChange)=='undefined' ? true : myself.postChange();
    });
  },

  schedulePrptComponent: function(){

    var parameters={};
    var sharedUuid;
    var error=false;
      guid = function(){
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, 
        function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);  
        });

    }
    triggerError = function(msg,id){
      error=true;
      $(id).css("backgroundColor","rgb(255,159,159)");//error state color.
      //$(id).css("backgroundColor","rgb(184,245,177)"); Valid state color. aplicable?
      var temp = $(id).val();
      $(id).val(msg);

      setTimeout(function(){$(id).css("backgroundColor","white");
      $(id).val(temp);},2000);

    }

    getFileName = function() {
      var path = myself.path;
      return path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
    }

    getDefaultLocation = function() {
      return "/home/" + Dashboards.context.user;
    }

    getHour = function(){
    var hour=$("#hours").val();
    if($("#amPm").val()=="pm") {
        hour= parseInt(hour, 10) + 12;
      if (hour==24)
        hour=12;
    } else {
        if (hour == "12")
            hour = 0;
    }
    return hour;
    }

    getUTC = function(exp, end){
      var arr=exp.split("/");
      if (end) {
        return new Date(arr[2],arr[0]-1,arr[1],23,59,59,0).getTime();
      } else {
        return new Date(arr[2],arr[0]-1,arr[1],0,0,0,0).getTime();
      }
    }

    getISO = function(exp){
      var arr=exp.split("/");
      return new Date(arr[2],arr[0]-1,arr[1],0,0,0,0).toISOString();
    }

     makeSelect = function(min,max,interval,id){
      var selectHtml = '<select id ="'+id+'">';
      for(var i=min;i<=max;i+=interval){
        if(i<10)
        selectHtml += '<option value="'+i+'">0'+i+'</option>';
      else selectHtml += '<option value="'+i+'">'+i+'</option>';
      }
      selectHtml += '</select>';
      return selectHtml;

    }
    validateStartDate=function(mili,id){
      var now = new Date();
      if(isNaN(mili)||mili<now.getTime())
        triggerError("Incorrect Date, pick date from calendar",id);
    }
    validateEndDate=function(mili,id){
      if($("#endByRadio").is(":checked")){
      var now = new Date();
      var startDate = $("#rangeStartIn").val();
      var mil = getUTC(startDate);
      if(isNaN(mil)){}
      else if(mil > mili)
        triggerError("End Date > Start Date",id); 
      else if(isNaN(mili) || mili < now.getTime())
        triggerError("Incorrect Date",id);
      }
    }

    validateName = function(name) {
      if(name == "") {
        triggerError("You must choose a name","#nameIn");
      }
      var pattern = /[^0-9a-zA-Z ]/;
      if (name.match(pattern)) {
       triggerError('Invalid characters, alpha-numeric text only.',"#nameIn"); 
      }
    }

    startTimeGetter =function(selector){
        var hours = getHour();
        var minutes=$("#minutes").val();
        var mili = (minutes*60000)+(hours*3600000);
        var start;
        if (selector != undefined){
          start = getUTC($(selector).val()) + mili;
          validateStartDate(start,selector);
        } else {
          start = getUTC($("#rangeStartIn").val()) + mili;
          validateStartDate(start,"#rangeStartIn");
        }
        return new Date(start).toISOString();
    }
     endTimeGetter=function(){
      var end = getUTC($("#endByIn").val(), true);
      validateEndDate(end,"#endByIn");
        return new Date(end).toISOString();
    }

    getSelectedDaysOfWeek = function(){
      var selectedDays = new Array();
      var i = 0;
      if ($("#sunday").is(":checked")){
          selectedDays[i++] = 0;
      }
      if ($("#monday").is(":checked")){
       selectedDays[i++] = 1;
      }
      if ($("#tuesday").is(":checked")){
        selectedDays[i++] = 2;
      }
      if ($("#wednesday").is(":checked")){
        selectedDays[i++] = 3;
      }
      if ($("#thursday").is(":checked")){
        selectedDays[i++] = 4;
      }
      if ($("#friday").is(":checked")){
        selectedDays[i++] = 5;
      }
      if ($("#saturday").is(":checked")){
        selectedDays[i++] = 6;
      }
      return selectedDays;
    } 
    getDayOfMonth = function(){
      dayOfMonth = $("#recurrPatternIn").val();
      if(dayOfMonth<1) {
        triggerError(">0","#recurrPatternIn");
      }
      else if(dayOfMonth>31) {
        triggerError("<=31","#recurrPatternIn");
      }
      return dayOfMonth;
    }

      setParameters = function(){

         parameters = {
                  inputFile: myself.path,
                  jobName: $('#nameIn').val(),
                  outputFile: $('#locationIn').val()
                };

      error=false;                               
      var choice = $("#recurrId").val();
      var name = $("#nameIn").val();
      validateName(name);
      switch (choice)
      {

         case "once":
        var start = startTimeGetter("#startDateIn");
        var simpleJobTrigger = {
          repeatCount: 0,
          repeatInterval: 0,
          startTime: start,
          uiPassParam: "RUN_ONCE"
        };
        parameters["simpleJobTrigger"] = simpleJobTrigger;
        break;

        case "seconds":
        var start = startTimeGetter();
        var repeatSec = $("#recurrPatternInSec").val();
        if(repeatSec < 1) {
            triggerError(">0","#recurrPatternInSec");
        }
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var simpleJobTrigger = {
          endTime: endDate,
          repeatCount: -1,
          repeatInterval: repeatSec,
          startTime: start,
          uiPassParam: "SECONDS"

        };
        parameters["simpleJobTrigger"] = simpleJobTrigger;
        break;

        case "minutes":
        var start = startTimeGetter();
        var repeatMin = $("#recurrPatternInMin").val();
        if(repeatMin < 1) {
            triggerError(">0","#recurrPatternInMin");
          }
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var simpleJobTrigger = {
          endTime: endDate,
          repeatCount: -1,
          repeatInterval: repeatMin * 60,
          startTime: start,
          uiPassParam: "MINUTES"
        };
        parameters["simpleJobTrigger"] = simpleJobTrigger;
        break;

        case "hours":
        var start = startTimeGetter();
        var repeatHour = $("#recurrPatternInHour").val();
        if(repeatHour < 1) {
          triggerError(">0","#recurrPatternInHour");
        }
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var simpleJobTrigger = {
          endTime: endDate,
          repeatCount: -1,
          repeatInterval: repeatHour * 3600,
          startTime: start,
          uiPassParam: "HOURS"
        };
        parameters["simpleJobTrigger"] = simpleJobTrigger;
        break;

        case "daily":
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var start = startTimeGetter();
        if($("#weekDayRadio").is(":checked")){
          var complexJobTrigger = {
            daysOfWeek: [1, 2, 3, 4, 5],
            endTime: endDate,
            startTime: start,
            uiPassParam: "DAILY"
          };
          parameters["complexJobTrigger"] = complexJobTrigger;
        }
        else if($("#dayRadio").is(":checked")){
          var repeatDays = $("#recurrPatternInDay").val();
          if(repeatDays < 1) {
            triggerError(">0","#recurrPatternInDay");
          }
          var simpleJobTrigger = {
            entTime: endDate,
            repeatCount: -1,
            repeatInterval: repeatDays * 86400,
            startTime: start,
            uiPassParam: "DAILY"
          };
          parameters["simpleJobTrigger"] = simpleJobTrigger;
        }
        break;

        case "weekly":
        var start = startTimeGetter();
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var complexJobTrigger = {
          daysOfWeek: getSelectedDaysOfWeek() ,
          endTime: endDate,
          startTime: start,
          uiPassParam: "WEEKLY"
        };
        parameters["complexJobTrigger"] = complexJobTrigger;
        break;

        case "monthly":
        var start = startTimeGetter();
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var complexJobTrigger = {
          endTime: endDate,
          startTime: start,
          uiPassParam: "MONTHLY"
        };
        if($("#monthRadio").is(":checked")){
          complexJobTrigger["daysOfMonth"] = getDayOfMonth();
        } else {
          complexJobTrigger["daysOfWeek"] = $("#monthOpt2Select").val();
          complexJobTrigger["weeksOfMonth"] = $("#monthOpt1Select").val(); 
        }
        parameters["complexJobTrigger"] = complexJobTrigger;
        break;

        case "yearly":
        var start = startTimeGetter();
        if($("#endByRadio").is(":checked")) {
          var endDate = endTimeGetter();
        }
        var complexJobTrigger = {
          endTime: endDate,
          startTime: start,
          uiPassParam: "YEARLY"
        }
        if($("#yearRadio").is(":checked")) {
          complexJobTrigger["daysOfMonth"] = getDayOfMonth();
          complexJobTrigger["monthsOfYear"] = $("#yearEveryMonth").val();
        } else {
          complexJobTrigger["daysOfWeek"] = $("#yearOpt2Select").val();
          complexJobTrigger["monthsOfYear"] = $("#yearMonthSelect").val();
          complexJobTrigger["weeksOfMonth"] = $("#yearOpt1Select").val();
        }
        parameters["complexJobTrigger"] = complexJobTrigger;
        break;

        case "cron":
        var cron = $("#cronString").val();
        validateCron(cron);
        var start = getISO($("#rangeStartIn").val());
        if($("#endByRadio").is(":checked")) {
          endDate = endTimeGetter();
        }
        var cronJobTrigger = {
          cronString: cron,
          endTime: endDate,
          startTime: start,
          uiPassParam: "CRON"
        };
        parameters["cronJobTrigger"]  = cronJobTrigger;
        break;
      }
    }

    validateCron=function(cron){
      var arr=cron.split(" ");//7 elements - sec min hour dayOfMonth month dayOfWeek year
      if(arr.length<7)
        triggerError("Cron Expression too short","#cronString");
      else if(arr.length>7)
        triggerError("Cron Expression too long","#cronString");
      else if((arr[3]!="?"&&arr[3]!="*")&&(arr[5]!="?"&&arr[5]!="*"))
        triggerError("M+W unsuported.(M+? or W+?)","#cronString");//day of month and day of week not suported at the same time


    }
    hideAll = function(){
        $("#rangeOfRecurrDiv").hide();
        $("#cronDiv").hide();
        $("#recurrPatternDiv").hide();
        $("#startTimeDiv").hide();
        $("#rangeOfRecurrOnceDiv").hide();
        $("#patternSec").hide();
        $("#patternMin").hide();
        $("#patternHour").hide();
        $("#patternDay").hide();
        $("#patternWeek").hide();
        $("#patternMonth").hide();
        $("#patternYear").hide();
    }
    changeOpts= function(){
      var choice= $("#recurrId").val();
      hideAll();
      switch (choice)
      {
        case "once":
        $("#startTimeDiv").show();
        $("#rangeOfRecurrOnceDiv").show();
        break;
        case "seconds":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternSec").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "minutes":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternMin").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "hours":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternHour").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "daily":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternDay").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "weekly":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternWeek").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "monthly":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternMonth").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "yearly":
        $("#startTimeDiv").show();
        $("#recurrPatternDiv").show();
        $("#patternYear").show();
        $("#rangeOfRecurrDiv").show();
        break;
        case "cron":
        $("#cronDiv").show();
        $("#rangeOfRecurrDiv").show();
        break;

      }

    }

    createJobParameter = function(paramName, defaultValue, paramType, forceDefault) {
      if( !forceDefault && (myself.getReportOptions()[paramName] != undefined )){
        return {name: paramName, stringValue: new Array( "" + myself.getReportOptions()[paramName]), type: paramType}
      } else {
        return {name: paramName, stringValue: new Array( "" + defaultValue), type: paramType};
      }
    }

    var myself = this;

    var monthOpts = '<option value="0">January</option>'+'<option value="1">February</option>'+
          '<option value="2">March</option>'+'<option value="3">April</option>'+
          '<option value="4">May</option>'+'<option value="5">June</option>'+
          '<option value="6">July</option>'+'<option value="7">August</option>'+
          '<option value="8">September</option>'+'<option value="9">October</option>'+
          '<option value="10">November</option>'+'<option value="11">December</option>';
    var weekOpts = '<option value="0">sunday</option>'+'<option value="1">monday</option>'+
          '<option value="2">tuesday</option>'+'<option value="3">wednesday</option>'+
          '<option value="4">thursday</option>'+'<option value="5">friday</option>'+
          '<option value="6">saturday</option>';
    var firstLastDropdown = '<option value="0">first</option>'+'<option value="1">second</option>'+
          '<option value="2">third</option>'+'<option value="3">fourth</option>'+
          '<option value="4">last</option>';
    var errorMessage = '<label id="err" style="display:none">Incorrect Input</label>';
    var nameDiv= '<div id="nameDiv"><form style="display:inline-block" id="nameForm"><span class="dialog-label">Name:</span><input id="nameIn" type="text" value="' + getFileName() + '"></form></div>';
    var locationDiv= '<div id="locationDiv"><form style="display:inline-block" id="nameForm"><span class="dialog-label">Location:</span><input id="locationIn" type="text" value="' + getDefaultLocation() + '"></form></div>';
    var groupDiv= '<div id="groupDiv"><form style="display:inline-block" id="groupForm"><span class="dialog-label">Group:</span><input id="groupIn" type="text" value=""></form></div>';
    var descriptionDiv= '<div><form style="display:inline-block" id="descForm"><span class="dialog-label">Description:</span><input id="descIn" type="text" value=""></form></div>';
    var recurrenceDiv = '<div id = "recurrenceDiv">'+
    '<br><span class="dialog-title" style="width: 100px; display: inline-block;">Recurrence:</span>'+
    '<select id="recurrId" onChange="changeOpts()" style="margin-left: 0px;">'+
    '<option value = "once" selected>Run Once</option>'+
    '<option value = "seconds">Seconds</option>'+
    '<option value = "minutes">Minutes</option>'+
    '<option value = "hours">Hours</option>'+
    '<option value = "daily">Daily</option>'+
    '<option value = "weekly">Weekly</option>'+
    '<option value = "monthly">Monthly</option>'+
    '<option value = "yearly">Yearly</option>'+
    '<option value = "cron">Cron</option></select></br></div>';

    var cronString='<div id="cronDiv"  style="display:none"><form><span class="dialog-label">Cron String:</span><input id="cronString" type="text" value=""></form></div>';
    var hours = makeSelect(1,12,1,"hours");
    var minutes = makeSelect(0,59,1,"minutes");
    var amPm='<select id = "amPm"><option value="am">AM</option><option value="pm">PM</option></select>';
    var startTime = '<div id="startTimeDiv"><br><span class="dialog-title" style="width: 100px; display: inline-block;">Start Time:</span>'+hours+minutes+amPm+'</div>';
    //var startDate='<div id="startDateDiv"><form>Start Date : <input id= "startDateIn" type="text" value=""></form></div>';
    var recurrencePattern='<div id="recurrPatternDiv" style = "display:none">'+
    '<div id="patternSec" >'+
      '<label style="display:inline-block; margin-left: 100px; font-weight: 500;">Every</label>&nbsp;&nbsp;'+
      '<form style="display:inline-block"><input id= "recurrPatternInSec" type="text" size="3" style="width:30px;"></form>'+
      '<label style="display:inline-block; font-weight: 500;"> second(s)</label>'+
    '</div>'+
    '<div id="patternMin" >'+
      '<label style="display:inline-block; margin-left: 100px; font-weight: 500;">Every</label>&nbsp;&nbsp;'+
      '<form style="display:inline-block"><input id= "recurrPatternInMin" type="text" size="3" style="width:30px;"></form>'+
      '<label style="display:inline-block; font-weight: 500;"> minute(s)</label>'+
    '</div>'+
    '<div id="patternHour" >'+
      '<label style="display:inline-block; margin-left: 100px; font-weight: 500;">Every</label>&nbsp;&nbsp;'+
      '<form style="display:inline-block"><input id= "recurrPatternInHour" type="text" size="3" style="width:30px;"></form>'+
      '<label style="display:inline-block; font-weight: 500;"> hour(s)</label>'+
    '</div>'+
    '<div id="patternDay" >'+
      '<input type="radio" name ="day" value="day" id="dayRadio" style="margin-left: 100px; font-weight: 500;" checked> <label style="display:inline-block">Every</label>&nbsp;&nbsp;'+
      '<form style="display:inline-block"><input id= "recurrPatternInDay" type="text" size="3" style="width:30px;"></form>'+
      '<label style="display:inline-block; font-weight: 500;"> day(s)</label></br>'+
      '<input type="radio" name ="day" value="weekDay" id="weekDayRadio" style="margin-left: 100px;"> Every weekday'+
    '</div>'+
    '<div id="patternWeek" >'+
      '<form>'+'<div id="errorCheckboxes" style="display:none"><label id="errWeek">Choose at least one week</label></div>'+
      '<input type="checkbox" name="weekday" value="monday" id="monday" style="margin-left: 100px;"> Monday'+
      '<input type="checkbox" name="weekday" value="tuesday" id="tuesday"> Tuesday'+
      '<input type="checkbox" name="weekday" value="wednesday" id="wednesday"> Wednesday'+
      '<input type="checkbox" name="weekday" value="thursday" id="thursday"> Thursday'+'</br>'+
      '<input type="checkbox" name="weekday" value="friday" id="friday" style="margin-left: 100px;"> Friday'+
      '<input type="checkbox" name="weekday" value="saturday" id="saturday"> Saturday'+
      '<input type="checkbox" name="weekday" value="sunday" id="sunday"> Sunday'+
      '</form>'+
    '</div>'+
    '<div id="patternMonth" >'+
      '<input id="monthRadio" type="radio" name ="month" value="day" style="margin-left: 100px;" checked> <label style="display:inline-block; font-weight: 500;">Day</label>&nbsp;&nbsp;'+
      '<form style="display:inline-block"><input id= "recurrPatternIn" type="text" size="3" style="width:205px;"></form>'+
      '<label style="display:inline-block; font-weight: 500;"> of every month</label></br>'+
      '<input type="radio" name ="month" value="the" style="margin-left: 100px;"> <label style="display:inline-block; font-weight: 500;">The</label>&nbsp;&nbsp;'+
        '<select id="monthOpt1Select">'+firstLastDropdown+
        '</select>'+
        '<select id="monthOpt2Select">'+weekOpts+
        '</select><label style=" font-weight: 500;"> of every month</label>'+
    '</div>'+
    '<div id="patternYear" >'+
      '<input id ="yearRadio" type="radio" name ="year" value="month" style="margin-left: 100px;" checked> <label style="display:inline-block; font-weight: 500;">Every</label>&nbsp;'+
      '<select id="yearEveryMonth">'+monthOpts+
        '</select><input id="yearDayMonth"type="text" size="3">'+'</br>'+
      '<input type="radio" name ="year" value="the" style="margin-left: 100px;"> <label style="display:inline-block; font-weight: 500;">The</label>&nbsp;'+
        '<select id="yearOpt1Select">'+firstLastDropdown+
        '</select>'+
        '<select id="yearOpt2Select">'+weekOpts+
        '</select><label style=" font-weight: 500;">of&nbsp;&nbsp;</label>'+
        '<select id="yearMonthSelect">'+monthOpts+'</select>'+
    '</div>'+
    '</div>';
   var rangeOfRecurrence='<div id="rangeOfRecurrDiv" style="display:none"><br><span class="dialog-title"><strong>Range of Recurrence:</strong> </span>'+
    '<form><span class="dialog-label">Start:</span><input type="text" id="rangeStartIn"></form>'+
    '<form><span class="dialog-label">End:</span><input type="radio" name ="end" value="noEnd" checked> No end date'+
    '</br><input type="radio" name ="end" value ="endBy" id="endByRadio" style="margin-left:100px;"> End by:&nbsp;&nbsp;'+
    '<input id= "endByIn" type="text" style="width:187px;"></form>'+
    '</div>';
   var rangeOfRecurrenceOnce='<div id="rangeOfRecurrOnceDiv"><form><span class="dialog-label">Start Date:</span><input id= "startDateIn" type="text" value=""></form></div>';
  

   var mailQuestion = '<div id="mailQuestionDiv">'+'<label>Would you like to email a copy when the schedule runs?</label>'+
   '<input type="radio" name="mailRadio" value="no" id="mailRadioNo" checked onClick=\'$("#mailInfoDiv").hide(350)\'>No</input>'+
   '<input type="radio" name="mailRadio" value="yes" id="mailRadioYes" onClick=\'$("#mailInfoDiv").show(350)\'>Yes</input>'+
   '</div>';
   var mailInfo = '<div id="mailInfoDiv" style="display:none">'+
   '<label>To: (Use a semi-colon or comma to separate multiple email adresses.)</label>'+
   '<form><input id="toInput" style="width:100%" type="text"></input></form>'+
   '<label>Subject:</label>'+
   '<form><input id="subjectInput" style="width:100%" type="text" value="' +getFileName() + ' schedule has successfully run.'+'"></input></form>'+
   '<label>Attachment Name:</label>'+
   '<form><input id="attachmentNameInput" style="width:100%" type="text" value="'+ $('#nameIn').val() +'"></input></form>'+
   '<label>Message (optional)</label>'+
   '<textArea id="messageInput" type="text" rows="4"></textArea>'+
   '</div>';

   scheduleRequest = function(sendMail){
    var outTarget = myself.outputTarget ? myself.outputTarget : "table/html;page-mode=page";

            var jobParameters = new Array();
            var k = 0;
            jobParameters[k++] = createJobParameter("output-target", outTarget, "string", true);
            jobParameters[k++] = createJobParameter("accepted-page", "0", "string");
            jobParameters[k++] = createJobParameter("showParameters", "true", "string");
            jobParameters[k++] = createJobParameter("renderMode", "XML", "string");
            jobParameters[k++] = createJobParameter("htmlProportionalWidth", "false", "string");

            if ( sendMail ) {
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_TO", $("#toInput").val(), "string");
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_CC", "", "string");
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_BCC", "", "string");
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_SUBJECT", $("#subjectInput").val(), "string");
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_MESSAGE", $("#messageInput").val(), "string");
              jobParameters[k++] = createJobParameter("_SCH_EMAIL_ATTACHMENT_NAME", $("#attachmentNameInput").val(), "string");
            }
            for (var i = 0; i < myself.parameters.length; i++) {
              jobParameters[k++] = createJobParameter(myself.parameters[i][0], myself.parameters[i][1], "string", true);
            }
            parameters["jobParameters"] = jobParameters;

            
            var success = false;
            var x = $.ajaxSettings.async;
            $.ajaxSetup({
              async: false
            });

            $.ajax({
              url: webAppPath + "/api/scheduler/job",
              type: "POST",
              data: JSON.stringify(parameters),
              contentType: "application/json",
              success: function (response) {
                alert("Successfully scheduled.");
                success = true;
                },
              error: function (response) {
                alert(response.responseText);
                sucess = false;
              }
            });

            $.ajaxSetup({
              async: x
            });
            return success;
   }

   var fullPage = nameDiv+locationDiv+recurrenceDiv+cronString+startTime+recurrencePattern+rangeOfRecurrence+rangeOfRecurrenceOnce;
   var mailPage = mailQuestion+mailInfo;

   var validEmailConfig = false;
    $.ajax({
      type: "GET",
      url: webAppPath + "/api/emailconfig/isValid",
      success: function(data) {validEmailConfig = data}
    });
        
      var promp = {

      basicState : {
        html: fullPage, 
        title: "Schedule Report",
        buttons: {
          "Cancel" : -1,
          "Ok" : 1
        },
        submit: function(e,v,m,f){

          sharedUuid = guid();
          if(e==-1) {$.prompt.close();}
          else if(e==1){
            setParameters();
            if (error) {
              parameters = {};
              return false;
            }
            if(validEmailConfig) {
              $("#attachmentNameInput").val($("#nameIn").val());
              $.prompt.goToState('mailState');
              return false;
            } else {
              return scheduleRequest();
            }
            
          }
      }
    },
      mailState : {
        html: mailPage, 
        title: "Schedule Report",
        buttons: {
          "Back" : -1,
          "Ok" : 1
        },
        submit: function(e,v,m,f){
          if(e==-1) {
            $.prompt.goToState('basicState');
            return false;
          }
          else if (e==1) {
            if ($("#mailRadioNo").is(':checked')){
              return scheduleRequest();
            } else if ($("#mailRadioYes").is(':checked')) {
              var pattern = /^\S+@\S+$/;
              if(!$("#toInput").val().match(pattern)){
              triggerError("Invalid email", "#toInput");
              return false;
            }
              return scheduleRequest(true);
            } else {return false;}
          }
        }
      }
  };
      $.prompt(promp, {classes: 'scheduler'});
      $(".scheduler #jqi").css("width", "510px");
      $(document).ready(function(ev) {
        $("#startDateIn").datepicker({minDate:0});
        $("#rangeStartIn").datepicker({minDate:0});
        $("#endByIn").datepicker({minDate:0});
         $("#startDateIn").datepicker("setDate",new Date());
        $("#rangeStartIn").datepicker("setDate",new Date());

});
      
}


});

var ExecutePrptComponent = PrptComponent.extend({
  visible: false,
 
  update : function() {
    // 2 modes of working; if it's a div, create a button inside it
    var myself = this;
    var o = $("#"+ this.htmlObject);
    if ($.inArray(o[0].tagName.toUpperCase(),["SPAN","DIV"]) > -1){
      // create a button
      o = $("<button/>").appendTo(o.empty());
      if (o[0].tagName=="DIV") o.wrap("<span/>");
      if (this.label != undefined) o.text(this.label);
      o.button();
    }
    o.unbind("click"); // Needed to avoid multiple binds due to multiple updates(ex:component with listeners)
    o.bind("click", function(){
      var success = typeof(myself.preChange)=='undefined' ? true : myself.preChange();
      if(success) {
        myself.executePrptComponent();
      }
      typeof(myself.postChange)=='undefined' ? true : myself.postChange();
    });
  },
 
  executePrptComponent: function(){
 
    var options = this.getOptions();
    var ts = "ts=" + new Date().getTime() + "&";
    var url = webAppPath + '/api/repos/' + this.composePath(options) + '/viewer?' + ts;
    var a=[];
    var encodeArray = function(k,v) {
      var arr = [];
      for (var i = 0; i < v.length;i++) {
        arr.push(encodeURIComponent(k)+'='+encodeURIComponent(v[i]));
      }
      return arr;
    };
    $.each(options,function(k,v){
      if (typeof v == 'object') {
        a.push.apply(a,encodeArray(k,v));
      } else {
        a.push(encodeURIComponent(k)+"="+encodeURIComponent(v));
      }
    });
    $.fancybox({
      type:"iframe",
      href: url + "?"+ a.join('&') ,
      width: $(window).width(),
      height:$(window).height() - 50
    });
 
  }
}
);

var AnalyzerComponent = BaseComponent.extend({

  update: function(){

    this.clear();

    var options = this.getOptions();
    var url = webAppPath + '/content/analyzer/';
    var myself=this;

    // enable editing the view?
    this.viewOnly?url+='viewer':url+='editor';

    var height = this.height? this.height: "480px";
    var width = this.width? this.width: "100%";

    var iFrameHTML = this.generateIframe(this.htmlObject,url,options,height,width);
    $("#"+this.htmlObject).html(iFrameHTML);
  },

  getOptions: function() {

    var options = {
      solution : this.solution,
      path: this.path,
      action: this.action,
      command: this.command == undefined? "open": this.command,
      showFieldList: this.showFieldList == undefined? false: this.showFieldList,
      showRepositoryButtons: this.showRepositoryButtons == undefined? false: this.showRepositoryButtons,
      frameless: this.frameless
    };

    // process params and update options
    $.map(this.parameters,function(k){
      options[k[0]] = k.length==3?k[2]: Dashboards.getParameterValue(k[1]);
    });

    return options;
  },

  generateIframe: function(htmlObject,url,parameters,height,width) {
    var iFrameHTML = '<iframe id="iframe_'+ htmlObject + '"' +
    ' frameborder="0"' +
    ' height="' + height + '"' +
    ' width="' + width + '"' +
    ' src="' + url + "?";

    iFrameHTML += $.param(parameters, true);
    iFrameHTML += "\"></iframe>";
    
    return iFrameHTML;
  }
});

var ExecuteXactionComponent = BaseComponent.extend({
  visible: false,

  update : function() {
    // 2 modes of working; if it's a div, create a button inside it
    var myself = this;
    var o = $("#"+ this.htmlObject);
    if ($.inArray(o[0].tagName.toUpperCase(),["SPAN","DIV"]) > -1){
      // create a button
      o = $("<button/>").appendTo(o.empty());
      if (o[0].tagName=="DIV") o.wrap("<span/>");
      if (this.label != undefined) o.text(this.label);
      o.button();
    }
    o.unbind("click"); // Needed to avoid multiple binds due to multiple updates(ex:component with listeners)
    o.bind("click", function(){
      var success = typeof(myself.preChange)=='undefined' ? true : myself.preChange();
      if(success) {
        myself.executeXAction();
      }
      typeof(myself.postChange)=='undefined' ? true : myself.postChange();
    });
  },

  executeXAction : function() {
    //var url = webAppPath + "/ViewAction?solution=" + this.solution + "&path=" + this.path + "&action=" + this.action + "&"; //legacy
  var ts = "ts=" + new Date().getTime() + "&";
  var url = webAppPath + "/api/repos/" + this.path.replace(/\//g, ':') + "/xaction?" + ts;

    var p = new Array(this.parameters.length);
    var parameters = [];

    for(var i= 0, len = p.length; i < len; i++){
      var key = this.parameters[i][0];
      var value = Dashboards.getParameterValue(this.parameters[i][1]);

      if($.isArray(value)) {
        $(value).each(function(p) {
          parameters.push(key + "=" + encodeURIComponent(this));
        });
      }
      else {
        parameters.push(key + "=" + encodeURIComponent(value));
      }
    }

    url += parameters.join("&");

    var _href = url.replace(/'/g,"&#39;");
    $.fancybox({
      type:"iframe",
      href:_href,
      width: $(window).width(),
      height:$(window).height() - 50
    });
  }

});
