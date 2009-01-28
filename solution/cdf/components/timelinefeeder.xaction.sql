<?xml version="1.0" encoding="UTF-8"?>
<action-sequence>
	<title>TimePlot data feeder</title>
	<version>1</version>
	<logging-level>WARN</logging-level>
	<documentation>
		<author>Pedro Alves</author>
		<description>This is the datafeeder for the timeplot component</description>
		<help/>
		<result-type/>
	</documentation>
	<inputs>
		<JNDI type="string">
			<sources>
				<request>jndi</request>
			</sources>
			<default-value/>
		</JNDI>
		<QUERY type="string">
			<sources>
				<request>query</request>
			</sources>
			<default-value/>
		</QUERY>
		<CUBE type="string">
			<sources>
				<request>cube</request>
			</sources>
			<default-value/>
		</CUBE>
		<ROLE type="string">
			<sources>
				<request>role</request>
			</sources>
			<default-value/>
		</ROLE>
		<CATALOG type="string">
			<sources>
				<request>catalog</request>
			</sources>
			<default-value/>
		</CATALOG>
		<QUERY_TYPE type="string">
			<sources>
				<request>queryType</request>
			</sources>
			<default-value>mdx</default-value>
		</QUERY_TYPE>
		<TOPCOUNT type="string">
			<sources>
				<request>topCount</request>
			</sources>
			<default-value>0</default-value>
		</TOPCOUNT> 
		<TOPCOUNTAXIS type="string">
			<sources>
				<request>topCountAxis</request>
			</sources>
			<default-value>columns</default-value>
		</TOPCOUNTAXIS> 
		<ORDERCOLUMNS type="string">
			<sources>
				<request>orderColumns</request>
			</sources>
			<default-value/>
		</ORDERCOLUMNS> 
	</inputs>
	<outputs>
		<text type="string">
			<destinations>
				<response>content</response>
			</destinations>
		</text>
	</outputs>
	<actions>
		<actions>
			<condition><![CDATA[QUERY_TYPE == "mdx"]]></condition>
			<action-definition>
				<component-name>MDXLookupRule</component-name>
				<action-type>OLAP</action-type>
				<action-inputs>
					<QUERY type="string"/>
					<JNDI type="string"/>
					<CATALOG type="string"/>
					<CUBE type="string"/>
					<ROLE type="string"/>
				</action-inputs>
				<action-resources/>
				<action-outputs>
					<query-results type="result-set" mapping="query_result"/>
				</action-outputs>
				<component-definition>
					<location><![CDATA[mondrian]]></location>
					<query>{QUERY}</query>
					<jndi>{JNDI}</jndi>
					<cube>{CUBE}</cube>
					<role>{ROLE}</role>
					<catalog>{CATALOG}</catalog>
				</component-definition>
			</action-definition>
			<action-definition>
				<component-name>JavascriptRule</component-name>
				<action-type>Format MDX Results</action-type>
				<action-inputs>
					<query_result type="result-set"/>
					<TOPCOUNT type="string" />
					<TOPCOUNTAXIS type="string" />
					<ORDERCOLUMNS type="string" />
				</action-inputs>
				<action-outputs>
					<text type="string"/>
				</action-outputs>
				<component-definition>
					<script><![CDATA[

					var text = "";

					var rsmd = query_result.getMetaData() ;
					var colHeaders = rsmd.getColumnHeaders() ;
					var rowHeaders = rsmd.getRowHeaders() ;
					var colCount = rsmd.getColumnCount() ;
					var rowCount = query_result.getRowCount() ;
					var colIteraction = colCount;
					var rowIteraction = rowCount;

					//Build Header
					var resultSetHeader = new Array(colCount) ;
					resultSetHeader[0] = 'Locations';
					var headers = new Array();
						
					var columnsValuesIndex = new Array();
					for(i = 0; i < colCount; i++){
						resultSetHeader[i+1] = colHeaders[0][i].toString() + '';
						columnsValuesIndex[colHeaders[0][i].toString()] = i;
					}

					if (TOPCOUNTAXIS == 'rows'){
						rowIteraction = TOPCOUNT==0||TOPCOUNT > rowCount?rowCount:TOPCOUNT ;
						out.println("Rows: " + rowIteraction);
					}
					if (TOPCOUNTAXIS == 'columns'){
						colIteraction = TOPCOUNT==0||TOPCOUNT > colCount?colCount:TOPCOUNT ;
					}
									
					if(TOPCOUNT == 0 && ORDERCOLUMNS != ""){
						var queryColumnsStr = resultSetHeader.join(",");
						ORDERCOLUMNS = ORDERCOLUMNS.split(",");
					
						for(i=0; i < ORDERCOLUMNS.length; i++){
							headers[i] = new Array();
							headers[i][1] = 0;
							if(queryColumnsStr.indexOf(ORDERCOLUMNS[i]) != -1){
								headers[i][0] = "";
								headers[i][1] = columnsValuesIndex[ORDERCOLUMNS[i]];
							}
							else
								headers[i][0] = "0";
						}
					}
									
					for (i=0; i<rowIteraction; i++)
					{
						var a = new Array();
						if(TOPCOUNT == 0 && ORDERCOLUMNS != ""){
							a[0] = rowHeaders[i][0];
							for(j = 0; j < headers.length; j++){
								if(headers[j][0]=="") {									
									a[j+1] = query_result.getValueAt(i,headers[j][1])-0||0;									
								}
								else
									a[j+1] = 0;
							}
						}
						else{
						
							a[0] = rowHeaders[i][0];
							for(j=0; j< colIteraction; j++){
								a[j+1] = query_result.getValueAt(i,j)-0;
							}
						
							if (TOPCOUNTAXIS == 'columns' && colIteraction != colCount){
								var value = 0;
								for (j=colIteraction; j<colCount; j++) {
									var localValue = query_result.getValueAt(i,j) - 0;
									value += localValue;
									//out.println("j: " + j + ", a1: " + a[1] + "; col: " + colHeaders[0][j] + "; Value: " + localValue);
								}
								a.push(value);
								//out.println("OTHERS: a0: " + a[0] + "; a1: " + a[1] + "; a2: " + a[2]);
							}
						}
						//out.println("a0: " + a[0] + "; a1: " + a[1] + "; a2: " + a[0] + "; Array: " + a);
						text += a.join(",");
						text += "\n";
					}

					// Other's block
					if (TOPCOUNTAXIS == 'rows' && rowIteraction != rowCount){

						// This will probably need a refactoring. All of this, actually :S
						var value = 0;
						var a = new Array();
						for(j = 0 ; j < colIteraction; j++){

							for (i=rowIteraction; i<rowCount; i++) {
								var localValue = query_result.getValueAt(i,j) - 0;
								value += localValue;
								//out.println("j: " + j + ", a1: " + a[1] + "; col: " + colHeaders[0][j] + "; Value: " + localValue);
							}
							a[0] = 'Others';
							a[j+1] = value;
						}
						//out.println("OTHERS: a0: " + a[0] + "; a1: " + a[1] + "; a2: " + a[2]);
						text += a.join(",");
						text += "\n";
					}

					text;

									]]></script>
							</component-definition>
						</action-definition>
					</actions>
					<actions>
						<condition><![CDATA[QUERY_TYPE != "mdx"]]></condition>
						<action-definition>
							<component-name>SQLLookupRule</component-name>
							<action-type>Relational</action-type>
							<action-inputs>
								<QUERY type="string"/>
								<JNDI type="string"/>
							</action-inputs>
							<action-outputs>
								<query-result type="result-set" mapping="query_result"/>
							</action-outputs>
							<component-definition>
								<jndi>{JNDI}</jndi>
								<live><![CDATA[false]]></live>
								<query>{QUERY}</query>
							</component-definition>
						</action-definition>
						<action-definition>
							<component-name>ResultSetCrosstabComponent</component-name>
							<action-type>CrossTab it</action-type>
							<action-inputs>
								<result_set type="result-set" mapping="query_result"/>
							</action-inputs>
							<action-outputs>
								<query-result2 type="result-set" mapping="query_result2"/>
							</action-outputs>
							<component-definition>
								<pivot_column>1</pivot_column>
								<measures_column>3</measures_column>
								<sort_by_column>2</sort_by_column>
							</component-definition>
						</action-definition>
						<action-definition>
							<component-name>JavascriptRule</component-name>
							<action-type>Format MDX Results</action-type>
							<action-inputs>
								<query_result type="result-set" mapping="query_result2"/>
								<ORDERCOLUMNS type="string" />
							</action-inputs>
							<action-outputs>
								<text type="string"/>
							</action-outputs>
							<component-definition>
								<script><![CDATA[

									// MDX to Relation result set, needed for the 

									var text = "";


									if (query_result != null)
									{


									var rsmd = query_result.getMetaData() ;
									var colHeaders = rsmd.getColumnHeaders() ;
									var rowHeaders = rsmd.getRowHeaders() ;
									var colCount = rsmd.getColumnCount() ;
									var rowCount = query_result.getRowCount() ;
									
									ORDERCOLUMNS = ORDERCOLUMNS.split(",");
									
									if(ORDERCOLUMNS != "") {
									
										var queryColumns = new Array();
										var columnsValuesIndex = new Array();
										for(i = 1; i < colCount; i++){
											queryColumns[i-1] = colHeaders[0][i].toString();
											columnsValuesIndex[queryColumns[i-1]] = i;
										}
										
										var queryColumnsStr = queryColumns.join(",");

										
										var headers = new Array();
										headers[0] = new Array();
										headers[0][0] = "";
										headers[0][1] = 0;
										for(i=0; i < ORDERCOLUMNS.length; i++){
										
											headers[i+1] = new Array();
											headers[i+1][1] = 0;
											if(queryColumnsStr.indexOf(ORDERCOLUMNS[i]) != -1)
											{
												headers[i+1][0] = "";
												headers[i+1][1] = columnsValuesIndex[ORDERCOLUMNS[i]];
											}
											else
												headers[i+1][0] = "0";
										}
										

										for (i=0; i<rowCount; i++) {

										var a = new Array();
										for(j = 0,k=0; j < headers.length; j++){
										
											if(headers[j][0]=="") {
												a[j] = query_result.getValueAt(i,headers[j][1]) ||0;
												k++;
											}
											else
												a[j] = 0;
										}

										text += a.join(",");
										text += "\n";
										
										}
									}
									else
									{
										for (i=0; i<rowCount; i++) {
											var a = new Array();
											for(j = 0; j < colCount; j++){
												a[j] = query_result.getValueAt(i,j) ||0;
											}
										
										text += a.join(",");
										text += "\n";
										
										}
									}
								
									text;
									
									}

									]]></script>
								</component-definition>
							</action-definition>
						</actions>
					</actions>
				</action-sequence>

				
